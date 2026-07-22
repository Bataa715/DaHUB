import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { AuditLogService } from "../audit/audit-log.service";

export interface RiskCurrentRow {
  rowKey: string;
  rowType: "oracle" | "manual_indicator";
  fetchedAt: string;
  pDate: string;
  pDateBeg: string;
  SOLID: string;
  BRANCHNAME: string;
  STATUS: string;
  RESULT: string;
  RESULT_TYPE: string;
  DESCRIPTION_TEXT: string;
  P_DATEBEG: string;
  P_DATE: string;
  ID: string;
  SUBID: string;
  OPERATION_TYPE: string;
  isManual: number;
  indicatorId: string;
  indicatorValue: number | null;
  /** Тухайн RESULT-ийн бодит fetchedDate (fill-forward шалгалтад) */
  sourceFetchedDate?: string;
}

export interface RiskHistoryEntry {
  id: string;
  name: string;
  pDate: string;
  pDateBeg: string;
  branchCount: number;
  oracleFetchedAt: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

@Injectable()
export class RiskAssessmentService implements OnModuleInit {
  private readonly logger = new Logger(RiskAssessmentService.name);

  constructor(
    private clickhouse: ClickHouseService,
    private readonly auditLog: AuditLogService,
  ) {}

  private auditMutation(
    userId: string,
    action: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    void this.auditLog.log({
      userId,
      action,
      resource: "risk_assessment",
      resourceId: resourceId ?? "",
      method: action,
      status: "success",
      metadata,
    });
  }

  async onModuleInit() {
    await this.ensureTables();
  }

  private async ensureTables() {
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_manual_indicators (
        branchId    String,
        indicatorId String,
        value       Float64 DEFAULT 0,
        updatedBy   String DEFAULT '',
        updatedAt   DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY (branchId, indicatorId)
    `);

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_assessment_history (
        id              String,
        name            String,
        pDate           String DEFAULT '',
        pDateBeg        String DEFAULT '',
        branchCount     UInt32 DEFAULT 0,
        oracleFetchedAt String DEFAULT '',
        rowsJson        String DEFAULT '[]',
        manualJson      String DEFAULT '{}',
        createdBy       String DEFAULT '',
        createdByName   String DEFAULT '',
        createdAt       DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(createdAt)
        ORDER BY id
    `);

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_indicator_holds (
        indicatorId  String,
        period       String,
        isHeld       UInt8 DEFAULT 1,
        updatedBy    String DEFAULT '',
        updatedAt    DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY (indicatorId, period)
    `);

    // Airflow-с Oracle riskbranch өгөгдөл орж ирэх хүснэгт
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS riskbranch (
        rowKey           String,
        fetchedDate      String DEFAULT '',
        fetchedAt        DateTime DEFAULT now(),
        SOLID            String DEFAULT '',
        BRANCHNAME       String DEFAULT '',
        STATUS           String DEFAULT '',
        RESULT           String DEFAULT '',
        RESULT_TYPE      String DEFAULT '',
        DESCRIPTION_TEXT String DEFAULT '',
        P_DATEBEG        String DEFAULT '',
        P_DATE           String DEFAULT '',
        ID               String DEFAULT '',
        SUBID            String DEFAULT '',
        OPERATION_TYPE   String DEFAULT ''
      ) ENGINE = ReplacingMergeTree(fetchedAt)
        ORDER BY (fetchedDate, rowKey)
    `);

    // Шинэ багана нэмэх (migration) — зөвхөн ADD, DROP биш тул local/prod хооронд
    // санамсаргүй өгөгдөл устгах эрсдэлгүй (аюулгүй, idempotent).
    await this.clickhouse
      .exec(
        `
      ALTER TABLE riskbranch ADD COLUMN IF NOT EXISTS STATUS String DEFAULT ''
    `,
      )
      .catch(() => {});

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS riskbranch_locks (
        fetchedDate String,
        lockedBy    String DEFAULT '',
        lockedAt    DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(lockedAt)
        ORDER BY fetchedDate
    `);

    // Аудиторын үнэлэмж (judgement) — нэг салбар нэг огноо нэг оноо
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_judgement (
        branchId   String,
        branchName String DEFAULT '',
        fetchedDate String,
        score      Float64 DEFAULT 0,
        comment    String DEFAULT '',
        updatedBy  String DEFAULT '',
        updatedAt  DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY (fetchedDate, branchId)
    `);
    await this.clickhouse
      .exec(
        `ALTER TABLE risk_judgement ADD COLUMN IF NOT EXISTS comment String DEFAULT ''`,
      )
      .catch(() => {});

    await this.clickhouse
      .exec(
        `ALTER TABLE risk_assessment_history ADD COLUMN IF NOT EXISTS judgementCommentsJson String DEFAULT '{}'`,
      )
      .catch(() => {});

    // ETL-аас тооцоолсон салбарын нийт оноо
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_branch_scores (
        fetch_date   String,
        branch_id    String,
        branch_name  String  DEFAULT '',
        solid        String  DEFAULT '',
        rating       String  DEFAULT '',
        region       String  DEFAULT 'UB',
        s1           Nullable(Float64),
        s2           Nullable(Float64),
        s3           Nullable(Float64),
        s4           Float64 DEFAULT 0,
        j            Float64 DEFAULT 0,
        total        Nullable(Float64),
        level        String  DEFAULT '',
        computed_at  DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(computed_at)
        ORDER BY (fetch_date, branch_id)
    `);
  }

  async listManualIndicators(): Promise<
    Record<string, Record<string, number>>
  > {
    const rows = await this.clickhouse.query<any>(
      `SELECT branchId, indicatorId, value
       FROM risk_manual_indicators FINAL
       WHERE value > 0`,
    );
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!r.branchId || !r.indicatorId) continue;
      (out[r.branchId] ?? (out[r.branchId] = {}))[r.indicatorId] = Number(
        r.value ?? 0,
      );
    }
    return out;
  }

  private async resolveJudgmentIndicatorId(): Promise<string | null> {
    const rows = await this.clickhouse.query<{ id: string }>(`
      SELECT id
      FROM risk_indicator_config FINAL
      WHERE is_active = 1 AND (is_judgment = 1 OR group_num = 5)
      ORDER BY is_judgment DESC, group_num DESC, sort_order ASC, id ASC
      LIMIT 1
    `);
    return rows[0]?.id ?? null;
  }

  async upsertManualIndicator(args: {
    branchId: string;
    indicatorId: string;
    value: number;
    userId: string;
  }): Promise<void> {
    const { branchId, indicatorId, value, userId } = args;
    if (!branchId || !indicatorId) return;
    const judgmentId = await this.resolveJudgmentIndicatorId();
    if (judgmentId && indicatorId === judgmentId) {
      throw new BadRequestException(
        "Аудиторын үнэлэмжийг PUT /risk-assessment/judgement ашиглан хадгална",
      );
    }
    if (!value || value <= 0) {
      await this.clickhouse.exec(
        `ALTER TABLE risk_manual_indicators DELETE WHERE branchId = {b:String} AND indicatorId = {i:String}`,
        { b: branchId, i: indicatorId },
      );
      return;
    }
    await this.clickhouse.insert("risk_manual_indicators", [
      {
        branchId,
        indicatorId,
        value: Math.min(5, Math.max(0, value)),
        updatedBy: userId,
        updatedAt: nowCH(),
      },
    ]);
    this.auditMutation(userId, "risk_manual_indicator_upsert", branchId, {
      indicatorId,
      value,
    });
  }

  async listHistory(): Promise<RiskHistoryEntry[]> {
    const rows = await this.clickhouse.query<any>(
      `SELECT id, name, pDate, pDateBeg, branchCount, oracleFetchedAt,
              createdBy, createdByName, toString(createdAt) AS createdAt
       FROM risk_assessment_history FINAL
       ORDER BY createdAt DESC LIMIT 200`,
    );
    return rows.map((r: any) => ({
      ...r,
      branchCount: Number(r.branchCount ?? 0),
    }));
  }

  async getHistory(id: string): Promise<{
    entry: RiskHistoryEntry;
    rows: any[];
    manualMap: Record<string, Record<string, number>>;
    judgementComments: Record<string, string>;
  }> {
    const found = await this.clickhouse.query<any>(
      `SELECT id, name, pDate, pDateBeg, branchCount, oracleFetchedAt,
              createdBy, createdByName, toString(createdAt) AS createdAt,
              rowsJson, manualJson, judgementCommentsJson
       FROM risk_assessment_history FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!found[0]) throw new NotFoundException("Түүх олдсонгүй");
    const r = found[0];
    let rows: any[] = [];
    let manualMap: Record<string, Record<string, number>> = {};
    let judgementComments: Record<string, string> = {};
    try {
      rows = JSON.parse(r.rowsJson || "[]");
    } catch {}
    try {
      manualMap = JSON.parse(r.manualJson || "{}");
    } catch {}
    try {
      judgementComments = JSON.parse(r.judgementCommentsJson || "{}");
    } catch {}
    return {
      entry: {
        id: r.id,
        name: r.name,
        pDate: r.pDate,
        pDateBeg: r.pDateBeg,
        branchCount: Number(r.branchCount ?? 0),
        oracleFetchedAt: r.oracleFetchedAt,
        createdBy: r.createdBy,
        createdByName: r.createdByName,
        createdAt: r.createdAt,
      },
      rows,
      manualMap,
      judgementComments,
    };
  }

  async deleteHistory(id: string, userId: string): Promise<void> {
    await this.clickhouse.exec(
      `ALTER TABLE risk_assessment_history DELETE WHERE id = {id:String}`,
      { id },
    );
    this.auditMutation(userId, "risk_history_delete", id);
  }

  // ── Indicator holds ──────────────────────────────────────────────────────

  async listHolds(
    period: string,
  ): Promise<{ indicatorId: string; isHeld: number }[]> {
    const rows = await this.clickhouse.query<any>(
      `SELECT indicatorId, isHeld
       FROM risk_indicator_holds FINAL
       WHERE period = {period:String} AND isHeld = 1`,
      { period },
    );
    return rows.map((r: any) => ({
      indicatorId: String(r.indicatorId),
      isHeld: Number(r.isHeld),
    }));
  }

  async setHold(
    indicatorId: string,
    period: string,
    isHeld: boolean,
    updatedBy: string,
  ): Promise<void> {
    await this.clickhouse.exec(
      `INSERT INTO risk_indicator_holds (indicatorId, period, isHeld, updatedBy, updatedAt)
       VALUES ({indicatorId:String}, {period:String}, {isHeld:UInt8}, {updatedBy:String}, now())`,
      {
        indicatorId,
        period,
        isHeld: isHeld ? 1 : 0,
        updatedBy,
      },
    );
    this.auditMutation(updatedBy, "risk_indicator_hold", indicatorId, {
      period,
      isHeld,
    });
  }

  /** riskbranch дахь өвөрмөц fetchedDate жагсаалт буцаана (YYYY-MM-DD форматаар) */
  async listRiskbranchDates(): Promise<string[]> {
    const rows = await this.clickhouse.query<any>(
      `SELECT DISTINCT LEFT(fetchedDate, 10) AS d
       FROM riskbranch FINAL
       WHERE fetchedDate != ''
       ORDER BY d DESC
       LIMIT 90`,
    );
    return rows.map((r: any) => String(r.d));
  }

  /** riskbranch-ийн хамгийн сүүлийн fetchedDate-ийн өгөгдөл */
  async getRiskbranchLatest(): Promise<{
    fetchedDate: string;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    const dates = await this.listRiskbranchDates();
    const latestDate = dates[0] ?? "";
    if (!latestDate) return { fetchedDate: "", rows: [], manualMap: {} };
    return this.getRiskbranchByDate(latestDate);
  }

  /** riskbranch-ийн тодорхой fetchedDate-ийн өгөгдөл.
   *
   * Fill-forward логик:
   *   Хэрэглэгч "2026-11-30" сонговол тухайн өдрийн data байхгүй байж болно.
   *   Тэр тохиолдолд <= тухайн өдрийн хамгийн ойр (сүүлийн) бодит fetchedDate-ийн
   *   data-г ачаална. Ингэснээр баталгаажсан data байхгүй огноо сонгогдсон ч
   *   хоосон үр дүн гарахгүй, харин хамгийн ойрын өгөгдлийг харуулна.
   */
  async getRiskbranchByDate(fetchedDate: string): Promise<{
    fetchedDate: string;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    // Огноог YYYY-MM-DD форматад normalize хийнэ
    const d = String(fetchedDate).slice(0, 10);

    // 1. Сонгосон огноогоос <= хамгийн ойр бодит fetchedDate олно (fill-forward anchor)
    const anchorRows = await this.clickhouse.query<any>(
      `SELECT MAX(LEFT(fetchedDate, 10)) AS maxDate
       FROM riskbranch FINAL
       WHERE LEFT(fetchedDate, 10) <= {d:String}
         AND fetchedDate != ''`,
      { d },
    );
    const anchor: string = anchorRows[0]?.maxDate ?? "";
    if (!anchor) return { fetchedDate: d, rows: [], manualMap: {} };

    // 2. Anchor өдрийн SOLID-уудад зориулж (SOLID, SUBID) бүрт
    //    anchor <= fetchedDate-ийн хамгийн сүүлийн RESULT авна
    const rows = await this.clickhouse.query<any>(
      `SELECT
         argMax(rowKey, fetchedDate)              AS rowKey,
         'oracle'                                 AS rowType,
         toString(argMax(fetchedAt, fetchedDate)) AS fetchedAt,
         ''                                       AS pDate,
         ''                                       AS pDateBeg,
         SOLID,
         argMax(BRANCHNAME, fetchedDate)          AS BRANCHNAME,
         argMax(STATUS, fetchedDate)              AS STATUS,
         argMax(RESULT, fetchedDate)              AS RESULT,
         argMax(RESULT_TYPE, fetchedDate)         AS RESULT_TYPE,
         argMax(DESCRIPTION_TEXT, fetchedDate)    AS DESCRIPTION_TEXT,
         argMax(P_DATEBEG, fetchedDate)           AS P_DATEBEG,
         argMax(P_DATE, fetchedDate)              AS P_DATE,
         argMax(ID, fetchedDate)                  AS ID,
         SUBID,
         argMax(OPERATION_TYPE, fetchedDate)      AS OPERATION_TYPE,
         0                                        AS isManual,
         ''                                       AS indicatorId,
         NULL                                     AS indicatorValue,
         LEFT(max(fetchedDate), 10)               AS sourceFetchedDate
       FROM riskbranch FINAL
       WHERE LEFT(fetchedDate, 10) <= {anchor:String}
         AND SOLID IN (
           SELECT SOLID FROM riskbranch FINAL
           WHERE LEFT(fetchedDate, 10) = {anchor:String}
         )
       GROUP BY SOLID, SUBID
       ORDER BY BRANCHNAME, toUInt32OrZero(SUBID)`,
      { anchor },
    );
    // fetchedDate-г бодит anchor-оор буцаана (UI-д харуулах зорилгоор)
    return { fetchedDate: anchor, rows, manualMap: {} };
  }

  /**
   * Бүх indicator-ын хамгийн сүүлийн утгийг нэг дор буцаана.
   * (SOLID, SUBID) бүрт RESULT хоосон БУС хамгийн сүүлийн fetchedDate-ийн утгыг авна.
   */
  async getRiskbranchLatestAll(): Promise<{
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    const rows = await this.clickhouse.query<any>(
      `SELECT
         argMax(rowKey, fetchedDate)              AS rowKey,
         'oracle'                                 AS rowType,
         toString(argMax(fetchedAt, fetchedDate)) AS fetchedAt,
         ''                                       AS pDate,
         ''                                       AS pDateBeg,
         SOLID,
         argMax(BRANCHNAME, fetchedDate)          AS BRANCHNAME,
         argMax(STATUS, fetchedDate)              AS STATUS,
         argMax(RESULT, fetchedDate)              AS RESULT,
         argMax(RESULT_TYPE, fetchedDate)         AS RESULT_TYPE,
         argMax(DESCRIPTION_TEXT, fetchedDate)    AS DESCRIPTION_TEXT,
         argMax(P_DATEBEG, fetchedDate)           AS P_DATEBEG,
         argMax(P_DATE, fetchedDate)              AS P_DATE,
         argMax(ID, fetchedDate)                  AS ID,
         SUBID,
         argMax(OPERATION_TYPE, fetchedDate)      AS OPERATION_TYPE,
         0                                        AS isManual,
         ''                                       AS indicatorId,
         NULL                                     AS indicatorValue,
         max(fetchedDate)                         AS latestFetchedDate
       FROM riskbranch FINAL
       WHERE fetchedDate != ''
       GROUP BY SOLID, SUBID
       ORDER BY BRANCHNAME, toUInt32OrZero(SUBID)`,
    );
    return { rows, manualMap: {} };
  }

  // ── Lock ──────────────────────────────────────────────────────────────────

  /** Тухайн огноог lock хийх */
  async lockDate(fetchedDate: string, userId: string): Promise<void> {
    const d = String(fetchedDate).slice(0, 10);
    await this.clickhouse.insert("riskbranch_locks", [
      {
        fetchedDate: d,
        lockedBy: userId,
        lockedAt: nowCH(),
      },
    ]);
    this.logger.log(`lockDate: "${d}" by ${userId}`);
    this.auditMutation(userId, "risk_lock_date", d);
  }

  /** Тухайн огноог unlock хийх */
  async unlockDate(fetchedDate: string, userId: string): Promise<void> {
    const d = String(fetchedDate).slice(0, 10);
    await this.clickhouse.exec(
      `ALTER TABLE riskbranch_locks DELETE WHERE LEFT(fetchedDate, 10) = {d:String}`,
      { d },
    );
    this.logger.log(`unlockDate: "${d}"`);
    this.auditMutation(userId, "risk_unlock_date", d);
  }

  /** Одоо lock хийгдсэн огноог авах (байхгүй бол null) */
  async getLockedDate(): Promise<string | null> {
    const rows = await this.clickhouse.query<any>(
      `SELECT fetchedDate FROM riskbranch_locks FINAL ORDER BY lockedAt DESC LIMIT 1`,
    );
    return rows[0]?.fetchedDate ?? null;
  }

  // ── Judgement ─────────────────────────────────────────────────────────────

  /** Тодорхой огноогийн бүх салбарын аудиторын үнэлэмжийг авах */
  async listJudgements(fetchedDate?: string): Promise<
    {
      branchId: string;
      branchName: string;
      fetchedDate: string;
      score: number;
      comment: string;
    }[]
  > {
    const d = fetchedDate ? String(fetchedDate).slice(0, 10) : undefined;
    const rows = await this.clickhouse.query<any>(
      d
        ? `SELECT branchId, branchName, fetchedDate, score, comment FROM risk_judgement FINAL WHERE LEFT(fetchedDate, 10) = {d:String} AND score > 0 ORDER BY branchId`
        : `SELECT branchId, branchName, fetchedDate, score, comment FROM risk_judgement FINAL WHERE score > 0 ORDER BY fetchedDate DESC, branchId`,
      d ? { d } : {},
    );
    return rows.map((r: any) => ({
      branchId: String(r.branchId),
      branchName: String(r.branchName ?? ""),
      fetchedDate: String(r.fetchedDate),
      score: Number(r.score ?? 0),
      comment: String(r.comment ?? ""),
    }));
  }

  /** Аудиторын үнэлэмжийг хадгалах */
  async upsertJudgement(args: {
    branchId: string;
    branchName: string;
    fetchedDate: string;
    score: number;
    comment?: string;
    userId: string;
  }): Promise<void> {
    if (!args.branchId) return;
    const score = args.score <= 0 ? 0 : Math.min(5, Math.max(0, args.score));
    const comment = score <= 0 ? "" : String(args.comment ?? "").slice(0, 8000);
    await this.clickhouse.insert("risk_judgement", [
      {
        branchId: args.branchId,
        branchName: args.branchName,
        fetchedDate: String(args.fetchedDate).slice(0, 10),
        score,
        comment,
        updatedBy: args.userId,
        updatedAt: nowCH(),
      },
    ]);
    this.auditMutation(args.userId, "risk_judgement_upsert", args.branchId, {
      fetchedDate: args.fetchedDate,
      score,
      hasComment: comment.length > 0,
    });
  }
  async saveHistoryFromRiskbranch(args: {
    fetchedDate: string;
    name: string;
    userId: string;
    userName: string;
    /** Дэлгэц дээр харагдаж буй snapshot — өгвөл дахин татахгүй */
    rows?: any[];
    manualMap?: Record<string, Record<string, number>>;
    judgementComments?: Record<string, string>;
  }): Promise<RiskHistoryEntry> {
    let oracleRows: any[];
    let manualMap: Record<string, Record<string, number>>;
    let judgementComments: Record<string, string> = {};

    if (Array.isArray(args.rows) && args.rows.length > 0) {
      oracleRows = args.rows.filter((r) => r?.rowType === "oracle");
      manualMap = args.manualMap ?? {};
      judgementComments = args.judgementComments ?? {};
    } else {
      const source = await this.getRiskbranchByDate(args.fetchedDate);
      const judgements = await this.listJudgements(args.fetchedDate);
      const manualIndicators = await this.listManualIndicators();
      const judgmentId = await this.resolveJudgmentIndicatorId();

      manualMap = {};
      for (const [branchId, indMap] of Object.entries(manualIndicators)) {
        const cleaned = { ...indMap };
        if (judgmentId) delete cleaned[judgmentId];
        if (Object.keys(cleaned).length > 0) {
          manualMap[branchId] = cleaned;
        }
      }
      for (const j of judgements) {
        if (!manualMap[j.branchId]) manualMap[j.branchId] = {};
        if (judgmentId) manualMap[j.branchId][judgmentId] = j.score;
        if (j.comment) judgementComments[j.branchId] = j.comment;
      }
      oracleRows = source.rows;
    }

    const oracleFetchedAt =
      String(
        oracleRows[0]?.sourceFetchedDate ?? oracleRows[0]?.fetchedAt ?? "",
      ).slice(0, 10) || "";
    const id = randomUUID();
    const createdAt = nowCH();
    const branchCount = new Set(oracleRows.map((r: any) => r.SOLID)).size;
    const pDate = args.fetchedDate;
    await this.clickhouse.insert("risk_assessment_history", [
      {
        id,
        name: args.name,
        pDate,
        pDateBeg: "",
        branchCount,
        oracleFetchedAt,
        rowsJson: JSON.stringify(oracleRows),
        manualJson: JSON.stringify(manualMap),
        judgementCommentsJson: JSON.stringify(judgementComments),
        createdBy: args.userId,
        createdByName: args.userName,
        createdAt,
      },
    ]);
    this.logger.log(
      `saveHistoryFromRiskbranch: "${args.name}" date=${pDate} (${oracleRows.length} мөр) by ${args.userId}`,
    );
    this.auditMutation(args.userId, "risk_history_save", id, {
      name: args.name,
      fetchedDate: pDate,
      branchCount,
    });
    return {
      id,
      name: args.name,
      pDate,
      pDateBeg: "",
      branchCount,
      oracleFetchedAt,
      createdBy: args.userId,
      createdByName: args.userName,
      createdAt,
    };
  }

  // ── ETL: pre-computed branch scores ──────────────────────────────────────

  /** ETL-аас тооцоолсон оноог ClickHouse-д хадгалах (upsert by date) */
  async upsertBranchScores(
    fetchDate: string,
    scores: {
      branchId: string;
      branchName: string;
      solid: string;
      rating: string;
      region: string;
      s1: number | null;
      s2: number | null;
      s3: number | null;
      s4: number;
      j: number;
      total: number | null;
      level: string;
    }[],
    userId: string,
  ): Promise<void> {
    if (!fetchDate || scores.length === 0) return;
    // Тухайн огноогийн хуучин дата устгана
    await this.clickhouse.exec(
      `ALTER TABLE risk_branch_scores DELETE WHERE fetch_date = {d:String}`,
      { d: fetchDate },
    );
    const now = nowCH();
    await this.clickhouse.insert(
      "risk_branch_scores",
      scores.map((s) => ({
        fetch_date: fetchDate,
        branch_id: s.branchId,
        branch_name: s.branchName,
        solid: s.solid,
        rating: s.rating,
        region: s.region,
        s1: s.s1,
        s2: s.s2,
        s3: s.s3,
        s4: s.s4,
        j: s.j,
        total: s.total,
        level: s.level,
        computed_at: now,
      })),
    );
    this.logger.log(
      `upsertBranchScores: date=${fetchDate} (${scores.length} салбар)`,
    );
    this.auditMutation(userId, "risk_branch_scores_upsert", fetchDate, {
      branchCount: scores.length,
    });
  }

  /** ClickHouse-аас тооцоолсон оноог авах */
  async getBranchScores(fetchDate?: string): Promise<
    {
      fetchDate: string;
      branchId: string;
      branchName: string;
      solid: string;
      rating: string;
      region: string;
      s1: number | null;
      s2: number | null;
      s3: number | null;
      s4: number;
      j: number;
      total: number | null;
      level: string;
    }[]
  > {
    let date = fetchDate;
    if (!date) {
      const latest = await this.clickhouse.query<any>(
        `SELECT fetch_date FROM risk_branch_scores FINAL
         ORDER BY fetch_date DESC LIMIT 1`,
      );
      date = latest[0]?.fetch_date ?? "";
    }
    if (!date) return [];
    const rows = await this.clickhouse.query<any>(
      `SELECT fetch_date, branch_id, branch_name, solid, rating, region,
              s1, s2, s3, s4, j, total, level
       FROM risk_branch_scores FINAL
       WHERE fetch_date = {d:String}
       ORDER BY branch_name`,
      { d: date },
    );
    return rows.map((r: any) => ({
      fetchDate: String(r.fetch_date),
      branchId: String(r.branch_id),
      branchName: String(r.branch_name ?? ""),
      solid: String(r.solid ?? ""),
      rating: String(r.rating ?? ""),
      region: String(r.region ?? "UB"),
      s1: r.s1 != null ? Number(r.s1) : null,
      s2: r.s2 != null ? Number(r.s2) : null,
      s3: r.s3 != null ? Number(r.s3) : null,
      s4: Number(r.s4 ?? 0),
      j: Number(r.j ?? 0),
      total: r.total != null ? Number(r.total) : null,
      level: String(r.level ?? ""),
    }));
  }
}

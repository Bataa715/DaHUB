import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";

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

  constructor(private clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  private async ensureTables() {
    for (const t of [
      "risk_indicators",
      "risk_scores",
      "risk_audit_log",
      "risk_branch_riskass_runs",
      "risk_branch_riskass_rows",
      "risk_assessment_snapshots",
    ]) {
      await this.clickhouse.exec(`DROP TABLE IF EXISTS ${t}`).catch(() => {});
    }

    // risk_assessment_current нь хуучин — risk_manual_indicators болгон нэгтгэв
    await this.clickhouse.exec(`DROP TABLE IF EXISTS risk_assessment_current`).catch(() => {});

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

    // Airflow-с Oracle realtime өгөгдөл орж ирэх хүснэгт
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_realtime (
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

    // Шинэ баганууд нэмэх / хуучин баганууд хасах (migration)
    await this.clickhouse.exec(`
      ALTER TABLE risk_realtime ADD COLUMN IF NOT EXISTS STATUS String DEFAULT ''
    `).catch(() => {});
    await this.clickhouse.exec(`
      ALTER TABLE risk_realtime DROP COLUMN IF EXISTS BRANCHID
    `).catch(() => {});
    await this.clickhouse.exec(`
      ALTER TABLE risk_realtime DROP COLUMN IF EXISTS PARENTBRANCH
    `).catch(() => {});
    await this.clickhouse.exec(`
      ALTER TABLE risk_realtime DROP COLUMN IF EXISTS REGION
    `).catch(() => {});

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_realtime_locks (
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
        updatedBy  String DEFAULT '',
        updatedAt  DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY (fetchedDate, branchId)
    `);

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
      (out[r.branchId] ?? (out[r.branchId] = {}))[r.indicatorId] = Number(r.value ?? 0);
    }
    return out;
  }

  async upsertManualIndicator(args: {
    branchId: string;
    indicatorId: string;
    value: number;
    userId: string;
  }): Promise<void> {
    const { branchId, indicatorId, value, userId } = args;
    if (!branchId || !indicatorId) return;
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
  }> {
    const found = await this.clickhouse.query<any>(
      `SELECT id, name, pDate, pDateBeg, branchCount, oracleFetchedAt,
              createdBy, createdByName, toString(createdAt) AS createdAt, rowsJson, manualJson
       FROM risk_assessment_history FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!found[0]) throw new NotFoundException("Түүх олдсонгүй");
    const r = found[0];
    let rows: any[] = [];
    let manualMap: Record<string, Record<string, number>> = {};
    try {
      rows = JSON.parse(r.rowsJson || "[]");
    } catch {}
    try {
      manualMap = JSON.parse(r.manualJson || "{}");
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
    };
  }

  async deleteHistory(id: string): Promise<void> {
    await this.clickhouse.exec(
      `ALTER TABLE risk_assessment_history DELETE WHERE id = {id:String}`,
      { id },
    );
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
  }

  // ── Realtime (Airflow-с Oracle → risk_realtime) ──────────────────────────

  /** risk_realtime дахь өвөрмөц fetchedDate жагсаалт буцаана */
  async listRealtimeDates(): Promise<string[]> {
    const rows = await this.clickhouse.query<any>(
      `SELECT DISTINCT fetchedDate
       FROM risk_realtime FINAL
       WHERE fetchedDate != ''
       ORDER BY fetchedDate DESC
       LIMIT 90`,
    );
    return rows.map((r: any) => String(r.fetchedDate));
  }

  /** risk_realtime-ийн хамгийн сүүлийн fetchedDate-ийн өгөгдөл */
  async getRealtimeLatest(): Promise<{
    fetchedDate: string;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    const dates = await this.listRealtimeDates();
    const latestDate = dates[0] ?? "";
    if (!latestDate) return { fetchedDate: "", rows: [], manualMap: {} };
    return this.getRealtimeByDate(latestDate);
  }

  /** risk_realtime-ийн тодорхой fetchedDate-ийн өгөгдөл */
  async getRealtimeByDate(fetchedDate: string): Promise<{
    fetchedDate: string;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    const rows = await this.clickhouse.query<any>(
      `SELECT rowKey, 'oracle' AS rowType, toString(fetchedAt) AS fetchedAt,
              '' AS pDate, '' AS pDateBeg,
              SOLID, BRANCHNAME, STATUS,
              RESULT, RESULT_TYPE, DESCRIPTION_TEXT, P_DATEBEG, P_DATE,
              ID, SUBID, OPERATION_TYPE,
              0 AS isManual, '' AS indicatorId, NULL AS indicatorValue
       FROM risk_realtime FINAL
       WHERE fetchedDate = {d:String}
       ORDER BY BRANCHNAME, toUInt32OrZero(SUBID)`,
      // Note: ID column removed (unused), updatedBy/manualResult removed
      { d: fetchedDate },
    );
    return { fetchedDate, rows, manualMap: {} };
  }

  /**
   * work page-д ашиглах range-based aggregated өгөгдөл.
   * SUBID бүрийн range_type-ийн дагуу ClickHouse-аас targetDate хүртэлх бүх
   * мөрийг татаж, салбар+SUBID тус бүрд дундаж / нийлбэр / сүүлийн тооцно.
   */
  async getRealtimeAggregated(targetDate: string): Promise<{
    fetchedDate: string;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    // SUBID → нэгтгэх арга ('avg' | 'sum' | 'last')
    const RANGE_AVG = new Set([
      'SUBID10', 'SUBID11', 'SUBID12',
      'SUBID23', 'SUBID26',
      'SUBID42', 'SUBID43', 'SUBID44', 'SUBID45',
    ]);
    const RANGE_SUM = new Set(['SUBID16', 'SUBID22', 'SUBID27', 'SUBID30', 'SUBID32']);

    const allRaw = await this.clickhouse.query<any>(
      `SELECT rowKey, toString(fetchedAt) AS fetchedAt, fetchedDate,
              SOLID, BRANCHNAME, STATUS,
              RESULT, RESULT_TYPE, DESCRIPTION_TEXT, P_DATEBEG, P_DATE,
              ID, SUBID, OPERATION_TYPE
       FROM risk_realtime FINAL
       WHERE fetchedDate <= {d:String}
       ORDER BY SOLID, SUBID, fetchedDate`,
      { d: targetDate },
    );

    // SOLID → мөрүүд
    const byBranch = new Map<string, any[]>();
    for (const r of allRaw) {
      const k = String(r.SOLID ?? '');
      if (!byBranch.has(k)) byBranch.set(k, []);
      byBranch.get(k)!.push(r);
    }

    const result: RiskCurrentRow[] = [];

    for (const brows of byBranch.values()) {
      // SUBID24 → аудит орсон огнооны дугаарыг DESCRIPTION_TEXT-ээс ол
      const sub24Latest = [...brows.filter(r => r.SUBID === 'SUBID24')]
        .sort((a, b) => String(b.fetchedDate).localeCompare(String(a.fetchedDate)))[0];
      let auditDate: string | null = null;
      if (sub24Latest) {
        const m = String(sub24Latest.DESCRIPTION_TEXT ?? '').match(/(\d{4}-\d{2}-\d{2})/);
        if (m) auditDate = m[1];
      }
      // Аудит огноо байхгүй бол сүүлийн 90 хоног
      const d90 = new Date(targetDate);
      d90.setDate(d90.getDate() - 90);
      const since = auditDate ?? d90.toISOString().slice(0, 10);

      // SUBID → мөрүүд
      const bySubid = new Map<string, any[]>();
      for (const r of brows) {
        const k = String(r.SUBID ?? '');
        if (!bySubid.has(k)) bySubid.set(k, []);
        bySubid.get(k)!.push(r);
      }

      for (const [subid, srows] of bySubid) {
        const sorted = [...srows].sort((a, b) =>
          String(b.fetchedDate).localeCompare(String(a.fetchedDate)));
        const latest = sorted[0];
        let effectiveResult = String(latest.RESULT ?? '');

        if (RANGE_AVG.has(subid) || RANGE_SUM.has(subid)) {
          const rangeRows = srows.filter(r => String(r.fetchedDate) >= since);
          const src = rangeRows.length > 0 ? rangeRows : srows;
          const nums = src
            .map(r => parseFloat(String(r.RESULT ?? '').replace(/[%,\s]/g, '')))
            .filter(n => !isNaN(n) && isFinite(n));
          if (nums.length > 0) {
            const val = RANGE_SUM.has(subid)
              ? nums.reduce((a, b) => a + b, 0)
              : nums.reduce((a, b) => a + b, 0) / nums.length;
            effectiveResult = String(Math.round(val * 100) / 100);
          }
        }

        result.push({
          rowKey: String(latest.rowKey ?? ''),
          rowType: 'oracle',
          fetchedAt: String(latest.fetchedAt ?? ''),
          pDate: '',
          pDateBeg: '',
          SOLID: String(latest.SOLID ?? ''),
          BRANCHNAME: String(latest.BRANCHNAME ?? ''),
          STATUS: String(latest.STATUS ?? ''),
          RESULT: effectiveResult,
          RESULT_TYPE: String(latest.RESULT_TYPE ?? ''),
          DESCRIPTION_TEXT: String(latest.DESCRIPTION_TEXT ?? ''),
          P_DATEBEG: String(latest.P_DATEBEG ?? ''),
          P_DATE: String(latest.P_DATE ?? ''),
          ID: String(latest.ID ?? ''),
          SUBID: subid,
          OPERATION_TYPE: String(latest.OPERATION_TYPE ?? ''),
          isManual: 0,
          indicatorId: '',
          indicatorValue: null,
        });
      }
    }

    return { fetchedDate: targetDate, rows: result, manualMap: {} };
  }

  // ── Lock ──────────────────────────────────────────────────────────────────

  /** Тухайн огноог lock хийх */
  async lockDate(fetchedDate: string, userId: string): Promise<void> {
    await this.clickhouse.insert("risk_realtime_locks", [
      {
        fetchedDate,
        lockedBy: userId,
        lockedAt: nowCH(),
      },
    ]);
    this.logger.log(`lockDate: "${fetchedDate}" by ${userId}`);
  }

  /** Тухайн огноог unlock хийх */
  async unlockDate(fetchedDate: string): Promise<void> {
    await this.clickhouse.exec(
      `ALTER TABLE risk_realtime_locks DELETE WHERE fetchedDate = {d:String}`,
      { d: fetchedDate },
    );
    this.logger.log(`unlockDate: "${fetchedDate}"`);
  }

  /** Одоо lock хийгдсэн огноог авах (байхгүй бол null) */
  async getLockedDate(): Promise<string | null> {
    const rows = await this.clickhouse.query<any>(
      `SELECT fetchedDate FROM risk_realtime_locks FINAL ORDER BY lockedAt DESC LIMIT 1`,
    );
    return rows[0]?.fetchedDate ?? null;
  }

  // ── Judgement ─────────────────────────────────────────────────────────────

  /** Тодорхой огноогийн бүх салбарын аудиторын үнэлэмжийг авах */
  async listJudgements(
    fetchedDate?: string,
  ): Promise<
    {
      branchId: string;
      branchName: string;
      fetchedDate: string;
      score: number;
    }[]
  > {
    const rows = await this.clickhouse.query<any>(
      fetchedDate
        ? `SELECT branchId, branchName, fetchedDate, score FROM risk_judgement FINAL WHERE fetchedDate = {d:String} AND score > 0 ORDER BY branchId`
        : `SELECT branchId, branchName, fetchedDate, score FROM risk_judgement FINAL WHERE score > 0 ORDER BY fetchedDate DESC, branchId`,
      fetchedDate ? { d: fetchedDate } : {},
    );
    return rows.map((r: any) => ({
      branchId: String(r.branchId),
      branchName: String(r.branchName ?? ""),
      fetchedDate: String(r.fetchedDate),
      score: Number(r.score ?? 0),
    }));
  }

  /** Аудиторын үнэлэмжийг хадгалах */
  async upsertJudgement(args: {
    branchId: string;
    branchName: string;
    fetchedDate: string;
    score: number;
    userId: string;
  }): Promise<void> {
    if (!args.branchId) return;
    // score=0 → үнэлэмжийг цэвэрлэх (ReplacingMergeTree-д 0 score оруулна,
    // listJudgements-ийн AND score>0 filter-ээр дараа уншихад харагдахгүй болно)
    await this.clickhouse.insert('risk_judgement', [
      {
        branchId: args.branchId,
        branchName: args.branchName,
        fetchedDate: args.fetchedDate,
        score: args.score <= 0 ? 0 : Math.min(5, Math.max(0, args.score)),
        updatedBy: args.userId,
        updatedAt: nowCH(),
      },
    ]);
  }

  /** risk_realtime + risk_judgement дата ашиглан history-д хадгалах */
  async saveHistoryFromRealtime(args: {
    fetchedDate: string;
    name: string;
    userId: string;
    userName: string;
  }): Promise<RiskHistoryEntry> {
    const source = await this.getRealtimeByDate(args.fetchedDate);
    const judgements = await this.listJudgements(args.fetchedDate);
    const manualMap: Record<string, Record<string, number>> = {};
    for (const j of judgements) {
      if (!manualMap[j.branchId]) manualMap[j.branchId] = {};
      manualMap[j.branchId]["j-001"] = j.score;
    }
    const oracleRows = source.rows;
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
        oracleFetchedAt: "",
        rowsJson: JSON.stringify(oracleRows),
        manualJson: JSON.stringify(manualMap),
        createdBy: args.userId,
        createdByName: args.userName,
        createdAt,
      },
    ]);
    this.logger.log(
      `saveHistoryFromRealtime: "${args.name}" date=${pDate} (${oracleRows.length} мөр) by ${args.userId}`,
    );
    return {
      id,
      name: args.name,
      pDate,
      pDateBeg: "",
      branchCount,
      oracleFetchedAt: "",
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

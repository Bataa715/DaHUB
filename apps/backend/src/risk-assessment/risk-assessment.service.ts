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
  BRANCHID: string;
  PARENTBRANCH: string;
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

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_assessment_current (
        rowKey           String,
        rowType          String DEFAULT 'oracle',
        fetchedAt        DateTime DEFAULT now(),
        pDate            String DEFAULT '',
        pDateBeg         String DEFAULT '',
        SOLID            String DEFAULT '',
        BRANCHNAME       String DEFAULT '',
        BRANCHID         String DEFAULT '',
        PARENTBRANCH     String DEFAULT '',
        RESULT           String DEFAULT '',
        RESULT_TYPE      String DEFAULT '',
        DESCRIPTION_TEXT String DEFAULT '',
        P_DATEBEG        String DEFAULT '',
        P_DATE           String DEFAULT '',
        ID               String DEFAULT '',
        SUBID            String DEFAULT '',
        OPERATION_TYPE   String DEFAULT '',
        isManual         UInt8 DEFAULT 0,
        indicatorId      String DEFAULT '',
        indicatorValue   Nullable(Float64)
      ) ENGINE = ReplacingMergeTree(fetchedAt)
        ORDER BY rowKey
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
        BRANCHID         String DEFAULT '',
        PARENTBRANCH     String DEFAULT '',
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

    // Тухайн огноог "lock" хийсэн тэмдэглэл
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
  }

  async getCurrentData(): Promise<{
    pDate: string;
    pDateBeg: string;
    oracleFetchedAt: string | null;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    const rows = await this.clickhouse.query<any>(
      `SELECT rowKey, rowType, toString(fetchedAt) AS fetchedAt,
              pDate, pDateBeg, SOLID, BRANCHNAME, BRANCHID, PARENTBRANCH,
              RESULT, RESULT_TYPE, DESCRIPTION_TEXT, P_DATEBEG, P_DATE,
              ID, SUBID, OPERATION_TYPE, isManual, indicatorId, indicatorValue
       FROM risk_assessment_current FINAL
       WHERE rowType != 'oracle'
          OR toDateTime(fetchedAt) = (
               SELECT max(toDateTime(fetchedAt))
               FROM risk_assessment_current FINAL
               WHERE rowType = 'oracle'
             )
       ORDER BY BRANCHNAME, toUInt32OrZero(SUBID)`,
    );
    const oracleRow = rows.find((r: any) => r.rowType === "oracle");
    const pDate = oracleRow?.pDate ?? "";
    const pDateBeg = oracleRow?.pDateBeg ?? "";
    const oracleFetchedAt = oracleRow?.fetchedAt ?? null;
    const manualMap: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (r.rowType === "manual_indicator" && r.indicatorId && r.BRANCHID) {
        const bucket = manualMap[r.BRANCHID] ?? (manualMap[r.BRANCHID] = {});
        bucket[r.indicatorId] = Number(r.indicatorValue ?? 0);
      }
    }
    return { pDate, pDateBeg, oracleFetchedAt, rows, manualMap };
  }

  async listManualIndicators(): Promise<
    Record<string, Record<string, number>>
  > {
    const rows = await this.clickhouse.query<any>(
      `SELECT BRANCHID, indicatorId, indicatorValue
       FROM risk_assessment_current FINAL
       WHERE rowType = 'manual_indicator' AND indicatorValue > 0`,
    );
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!r.BRANCHID || !r.indicatorId) continue;
      (out[r.BRANCHID] ?? (out[r.BRANCHID] = {}))[r.indicatorId] = Number(
        r.indicatorValue ?? 0,
      );
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
    const rowKey = `manual:${branchId}:${indicatorId}`;
    if (!value || value <= 0) {
      await this.clickhouse.exec(
        `ALTER TABLE risk_assessment_current DELETE WHERE rowKey = {k:String}`,
        { k: rowKey },
      );
      return;
    }
    const nameRow = await this.clickhouse.query<{ BRANCHNAME: string }>(
      `SELECT BRANCHNAME FROM risk_assessment_current FINAL WHERE BRANCHID = {b:String} AND rowType = 'oracle' LIMIT 1`,
      { b: branchId },
    );
    await this.clickhouse.insert("risk_assessment_current", [
      {
        rowKey,
        rowType: "manual_indicator",
        fetchedAt: nowCH(),
        pDate: "",
        pDateBeg: "",
        SOLID: "",
        BRANCHNAME: nameRow[0]?.BRANCHNAME ?? "",
        BRANCHID: branchId,
        PARENTBRANCH: "",
        RESULT: "",
        RESULT_TYPE: "",
        DESCRIPTION_TEXT: "",
        P_DATEBEG: "",
        P_DATE: "",
        ID: "",
        SUBID: "",
        OPERATION_TYPE: "",
        isManual: 1,
        indicatorId,
        indicatorValue: Math.min(5, Math.max(0, value)),
      },
    ]);
  }

  async saveHistory(args: {
    name: string;
    userId: string;
    userName: string;
  }): Promise<RiskHistoryEntry> {
    const current = await this.getCurrentData();
    const oracleRows = current.rows.filter((r: any) => r.rowType === "oracle");
    const id = randomUUID();
    const createdAt = nowCH();
    const branchCount = new Set(oracleRows.map((r: any) => r.BRANCHID)).size;
    await this.clickhouse.insert("risk_assessment_history", [
      {
        id,
        name: args.name,
        pDate: current.pDate,
        pDateBeg: current.pDateBeg,
        branchCount,
        oracleFetchedAt: current.oracleFetchedAt ?? "",
        rowsJson: JSON.stringify(oracleRows),
        manualJson: JSON.stringify(current.manualMap),
        createdBy: args.userId,
        createdByName: args.userName,
        createdAt,
      },
    ]);
    this.logger.log(
      `saveHistory: "${args.name}" (${oracleRows.length} мөр) by ${args.userId}`,
    );
    return {
      id,
      name: args.name,
      pDate: current.pDate,
      pDateBeg: current.pDateBeg,
      branchCount,
      oracleFetchedAt: current.oracleFetchedAt ?? "",
      createdBy: args.userId,
      createdByName: args.userName,
      createdAt,
    };
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

  async listHolds(period: string): Promise<{ indicatorId: string; isHeld: number }[]> {
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
              SOLID, BRANCHNAME, BRANCHID, PARENTBRANCH,
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

  // ── Lock ──────────────────────────────────────────────────────────────────

  /** Тухайн огноог lock хийх */
  async lockDate(fetchedDate: string, userId: string): Promise<void> {
    await this.clickhouse.insert('risk_realtime_locks', [{
      fetchedDate, lockedBy: userId, lockedAt: nowCH(),
    }]);
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
  async listJudgements(fetchedDate?: string): Promise<
    { branchId: string; branchName: string; fetchedDate: string; score: number }[]
  > {
    const rows = await this.clickhouse.query<any>(
      fetchedDate
        ? `SELECT branchId, branchName, fetchedDate, score FROM risk_judgement FINAL WHERE fetchedDate = {d:String} ORDER BY branchId`
        : `SELECT branchId, branchName, fetchedDate, score FROM risk_judgement FINAL ORDER BY fetchedDate DESC, branchId`,
      fetchedDate ? { d: fetchedDate } : {},
    );
    return rows.map((r: any) => ({
      branchId: String(r.branchId),
      branchName: String(r.branchName ?? ''),
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
    await this.clickhouse.insert('risk_judgement', [{
      branchId: args.branchId,
      branchName: args.branchName,
      fetchedDate: args.fetchedDate,
      score: Math.min(5, Math.max(0, args.score)),
      updatedBy: args.userId,
      updatedAt: nowCH(),
    }]);
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
      manualMap[j.branchId]['j-001'] = j.score;
    }
    const oracleRows = source.rows;
    const id = randomUUID();
    const createdAt = nowCH();
    const branchCount = new Set(oracleRows.map((r: any) => r.BRANCHID)).size;
    const pDate = args.fetchedDate;
    await this.clickhouse.insert('risk_assessment_history', [{
      id,
      name: args.name,
      pDate,
      pDateBeg: '',
      branchCount,
      oracleFetchedAt: '',
      rowsJson: JSON.stringify(oracleRows),
      manualJson: JSON.stringify(manualMap),
      createdBy: args.userId,
      createdByName: args.userName,
      createdAt,
    }]);
    this.logger.log(`saveHistoryFromRealtime: "${args.name}" date=${pDate} (${oracleRows.length} мөр) by ${args.userId}`);
    return {
      id, name: args.name, pDate, pDateBeg: '',
      branchCount, oracleFetchedAt: '',
      createdBy: args.userId, createdByName: args.userName, createdAt,
    };
  }

}


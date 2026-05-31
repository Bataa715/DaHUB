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
  updatedBy: string;
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
  manualResult: string;
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
        updatedBy        String DEFAULT '',
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
        manualResult     String DEFAULT '',
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
  }

  async getCurrentData(): Promise<{
    pDate: string;
    pDateBeg: string;
    oracleFetchedAt: string | null;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    const rows = await this.clickhouse.query<any>(
      `SELECT rowKey, rowType, toString(fetchedAt) AS fetchedAt, updatedBy,
              pDate, pDateBeg, SOLID, BRANCHNAME, BRANCHID, PARENTBRANCH,
              RESULT, RESULT_TYPE, DESCRIPTION_TEXT, P_DATEBEG, P_DATE,
              ID, SUBID, OPERATION_TYPE, isManual, manualResult, indicatorId, indicatorValue
       FROM risk_assessment_current FINAL
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
        updatedBy: userId,
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
        manualResult: "",
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

  /** Нэг мөрийн RESULT утгыг ClickHouse-д шууд засах */
  async overrideCurrentRow(
    rowKey: string,
    manualResult: string,
    changedBy: string,
  ): Promise<void> {
    const existing = await this.clickhouse.query<any>(
      `SELECT rowKey, pDate, pDateBeg, SOLID, BRANCHNAME, BRANCHID, PARENTBRANCH,
              RESULT_TYPE, DESCRIPTION_TEXT, P_DATEBEG, P_DATE, ID, SUBID, OPERATION_TYPE
       FROM risk_assessment_current FINAL WHERE rowKey = {k:String} LIMIT 1`,
      { k: rowKey },
    );
    if (existing.length === 0)
      throw new Error(`Мөр олдсонгүй: rowKey=${rowKey}`);
    const r = existing[0];
    await this.clickhouse.insert("risk_assessment_current", [
      {
        rowKey,
        rowType: "oracle",
        fetchedAt: nowCH(),
        updatedBy: changedBy,
        pDate: r.pDate,
        pDateBeg: r.pDateBeg,
        SOLID: r.SOLID,
        BRANCHNAME: r.BRANCHNAME,
        BRANCHID: r.BRANCHID,
        PARENTBRANCH: r.PARENTBRANCH,
        RESULT: manualResult,
        RESULT_TYPE: r.RESULT_TYPE,
        DESCRIPTION_TEXT: r.DESCRIPTION_TEXT,
        P_DATEBEG: r.P_DATEBEG,
        P_DATE: r.P_DATE,
        ID: r.ID,
        SUBID: r.SUBID,
        OPERATION_TYPE: r.OPERATION_TYPE,
        isManual: 1,
        manualResult,
        indicatorId: "",
        indicatorValue: null,
      },
    ]);
    this.logger.log(`overrideCurrentRow: ${rowKey} → "${manualResult}" by ${changedBy}`);
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
      `SELECT rowKey, 'oracle' AS rowType, toString(fetchedAt) AS fetchedAt, '' AS updatedBy,
              '' AS pDate, '' AS pDateBeg,
              SOLID, BRANCHNAME, BRANCHID, PARENTBRANCH,
              RESULT, RESULT_TYPE, DESCRIPTION_TEXT, P_DATEBEG, P_DATE,
              ID, SUBID, OPERATION_TYPE,
              0 AS isManual, '' AS manualResult, '' AS indicatorId, NULL AS indicatorValue
       FROM risk_realtime FINAL
       WHERE fetchedDate = {d:String}
       ORDER BY BRANCHNAME, toUInt32OrZero(SUBID)`,
      { d: fetchedDate },
    );
    return { fetchedDate, rows, manualMap: {} };
  }

  /** risk_realtime-ийн өгөгдлийг risk_assessment_current-д ачааллах */
  async loadRealtimeToCurrent(
    fetchedDate: string,
    userId: string,
  ): Promise<{ loaded: number }> {
    const source = await this.getRealtimeByDate(fetchedDate);
    if (source.rows.length === 0) {
      throw new Error(
        `${fetchedDate} өдрийн realtime өгөгдөл risk_realtime хүснэгтэд байхгүй байна`,
      );
    }
    const now = nowCH();
    // Хүснэгтийг бүрэн цэвэрлээд шинэ мөрүүдийг бичнэ
    await this.clickhouse.insert(
      "risk_assessment_current",
      source.rows.map((r: any) => ({
        rowKey: r.rowKey,
        rowType: "oracle",
        fetchedAt: now,
        updatedBy: userId,
        pDate: r.P_DATE ?? "",
        pDateBeg: r.P_DATEBEG ?? "",
        SOLID: r.SOLID ?? "",
        BRANCHNAME: r.BRANCHNAME ?? "",
        BRANCHID: r.BRANCHID ?? "",
        PARENTBRANCH: r.PARENTBRANCH ?? "",
        RESULT: r.RESULT ?? "",
        RESULT_TYPE: r.RESULT_TYPE ?? "",
        DESCRIPTION_TEXT: r.DESCRIPTION_TEXT ?? "",
        P_DATEBEG: r.P_DATEBEG ?? "",
        P_DATE: r.P_DATE ?? "",
        ID: r.ID ?? "",
        SUBID: r.SUBID ?? "",
        OPERATION_TYPE: r.OPERATION_TYPE ?? "",
        isManual: 0,
        manualResult: "",
        indicatorId: "",
        indicatorValue: null,
      })),
    );
    this.logger.log(
      `loadRealtimeToCurrent: "${fetchedDate}" (${source.rows.length} мөр) by ${userId}`,
    );
    return { loaded: source.rows.length };
  }

  // ── Work sessions (Хийх) ─────────────────────────────────────────────────

  /** Ажлын хуваарь байгаа өдрүүдийн жагсаалт */
  async listWorkSessions(): Promise<
    { workDate: string; rowCount: number; hasIndicators: boolean }[]
  > {
    const rows = await this.clickhouse.query<any>(
      `SELECT workDate,
              countIf(rowType = 'oracle') AS oracleCount,
              countIf(rowType = 'manual_indicator') AS indicatorCount
       FROM risk_work_sessions FINAL
       GROUP BY workDate
       ORDER BY workDate DESC
       LIMIT 90`,
    );
    return rows.map((r: any) => ({
      workDate: String(r.workDate),
      rowCount: Number(r.oracleCount ?? 0),
      hasIndicators: Number(r.indicatorCount ?? 0) > 0,
    }));
  }

  /** risk_realtime-ийн тухайн өдрийн мөрүүдийг work session-д ачааллах */
  async loadWorkSession(
    workDate: string,
    userId: string,
  ): Promise<{ loaded: number; alreadyExists: boolean }> {
    // Аль хэдэн байгаа эсэхийг шалгах
    const existing = await this.clickhouse.query<any>(
      `SELECT count() AS cnt FROM risk_work_sessions FINAL
       WHERE workDate = {d:String} AND rowType = 'oracle'`,
      { d: workDate },
    );
    const alreadyExists = Number(existing[0]?.cnt ?? 0) > 0;
    if (alreadyExists) return { loaded: 0, alreadyExists: true };

    const source = await this.getRealtimeByDate(workDate);
    if (source.rows.length === 0) {
      throw new Error(
        `${workDate} өдрийн realtime өгөгдөл risk_realtime хүснэгтэд байхгүй байна`,
      );
    }
    const updatedAt = nowCH();
    const batch = source.rows.map((r) => ({
      workDate,
      rowKey: `ws:${workDate}:oracle:${r.BRANCHID}:${r.SUBID}:${r.SOLID}`,
      rowType: "oracle" as const,
      updatedAt,
      updatedBy: userId,
      SOLID: r.SOLID,
      BRANCHNAME: r.BRANCHNAME,
      BRANCHID: r.BRANCHID,
      PARENTBRANCH: r.PARENTBRANCH,
      RESULT: r.RESULT,
      RESULT_TYPE: r.RESULT_TYPE,
      DESCRIPTION_TEXT: r.DESCRIPTION_TEXT,
      P_DATEBEG: r.P_DATEBEG,
      P_DATE: r.P_DATE,
      ID: r.ID,
      SUBID: r.SUBID,
      OPERATION_TYPE: r.OPERATION_TYPE,
      isManual: 0,
      manualResult: "",
      indicatorId: "",
      indicatorValue: null,
    }));
    const CHUNK = 1000;
    for (let i = 0; i < batch.length; i += CHUNK) {
      await this.clickhouse.insert("risk_work_sessions", batch.slice(i, i + CHUNK));
    }
    this.logger.log(`loadWorkSession: ${workDate} — ${batch.length} мөр`);
    return { loaded: batch.length, alreadyExists: false };
  }

  /** Тодорхой өдрийн work session өгөгдөл авах */
  async getWorkSession(workDate: string): Promise<{
    workDate: string;
    rows: RiskCurrentRow[];
    manualMap: Record<string, Record<string, number>>;
  }> {
    const rows = await this.clickhouse.query<any>(
      `SELECT rowKey, rowType, toString(updatedAt) AS fetchedAt, updatedBy,
              '' AS pDate, '' AS pDateBeg,
              SOLID, BRANCHNAME, BRANCHID, PARENTBRANCH,
              RESULT, RESULT_TYPE, DESCRIPTION_TEXT, P_DATEBEG, P_DATE,
              ID, SUBID, OPERATION_TYPE, isManual, manualResult, indicatorId, indicatorValue
       FROM risk_work_sessions FINAL
       WHERE workDate = {d:String}
       ORDER BY BRANCHNAME, toUInt32OrZero(SUBID)`,
      { d: workDate },
    );
    const manualMap: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (r.rowType === "manual_indicator" && r.indicatorId && r.BRANCHID) {
        (manualMap[r.BRANCHID] ?? (manualMap[r.BRANCHID] = {}))[r.indicatorId] =
          Number(r.indicatorValue ?? 0);
      }
    }
    return { workDate, rows, manualMap };
  }

  /** Work session дотор аудиторын үнэлэмжийг хадгалах */
  async upsertWorkSessionIndicator(args: {
    workDate: string;
    branchId: string;
    indicatorId: string;
    value: number;
    userId: string;
  }): Promise<void> {
    const { workDate, branchId, indicatorId, value, userId } = args;
    if (!branchId || !indicatorId || !workDate) return;
    const rowKey = `ws:${workDate}:manual:${branchId}:${indicatorId}`;
    if (!value || value <= 0) {
      await this.clickhouse.exec(
        `ALTER TABLE risk_work_sessions DELETE WHERE workDate = {d:String} AND rowKey = {k:String}`,
        { d: workDate, k: rowKey },
      );
      return;
    }
    const nameRow = await this.clickhouse.query<{ BRANCHNAME: string }>(
      `SELECT BRANCHNAME FROM risk_work_sessions FINAL
       WHERE workDate = {d:String} AND BRANCHID = {b:String} AND rowType = 'oracle' LIMIT 1`,
      { d: workDate, b: branchId },
    );
    await this.clickhouse.insert("risk_work_sessions", [
      {
        workDate,
        rowKey,
        rowType: "manual_indicator",
        updatedAt: nowCH(),
        updatedBy: userId,
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
        manualResult: "",
        indicatorId,
        indicatorValue: Math.min(5, Math.max(0, value)),
      },
    ]);
  }

  /** Work session-ийг risk_assessment_current-д нэгтгэх (finalizing) */
  async finalizeWorkSession(
    workDate: string,
    userId: string,
    userName: string,
  ): Promise<RiskHistoryEntry> {
    const session = await this.getWorkSession(workDate);
    if (!session.rows.some((r) => r.rowType === "oracle")) {
      throw new Error(`${workDate} өдрийн work session хоосон байна`);
    }
    // current-г арилгаад шинэ мэдээллээр солих
    await this.clickhouse.exec(
      `ALTER TABLE risk_assessment_current DELETE WHERE rowType = 'oracle' AND isManual = 0`,
    );
    const fetchedAt = nowCH();
    const batch = session.rows
      .filter((r) => r.rowType === "oracle")
      .map((r) => ({
        rowKey: `oracle:${r.BRANCHID}:${r.SUBID}:${r.SOLID}`,
        rowType: "oracle",
        fetchedAt,
        updatedBy: userId,
        pDate: workDate,
        pDateBeg: workDate,
        SOLID: r.SOLID,
        BRANCHNAME: r.BRANCHNAME,
        BRANCHID: r.BRANCHID,
        PARENTBRANCH: r.PARENTBRANCH,
        RESULT: r.RESULT,
        RESULT_TYPE: r.RESULT_TYPE,
        DESCRIPTION_TEXT: r.DESCRIPTION_TEXT,
        P_DATEBEG: r.P_DATEBEG,
        P_DATE: r.P_DATE,
        ID: r.ID,
        SUBID: r.SUBID,
        OPERATION_TYPE: r.OPERATION_TYPE,
        isManual: 0,
        manualResult: "",
        indicatorId: "",
        indicatorValue: null,
      }));
    await this.clickhouse.insert("risk_assessment_current", batch);
    // Manual indicators-г current-д шилжүүлэх
    const manualBatch = session.rows
      .filter((r) => r.rowType === "manual_indicator")
      .map((r) => ({
        rowKey: `manual:${r.BRANCHID}:${r.indicatorId}`,
        rowType: "manual_indicator",
        fetchedAt,
        updatedBy: userId,
        pDate: workDate,
        pDateBeg: workDate,
        SOLID: "",
        BRANCHNAME: r.BRANCHNAME,
        BRANCHID: r.BRANCHID,
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
        manualResult: "",
        indicatorId: r.indicatorId,
        indicatorValue: r.indicatorValue,
      }));
    if (manualBatch.length > 0) {
      await this.clickhouse.insert("risk_assessment_current", manualBatch);
    }
    this.logger.log(
      `finalizeWorkSession: ${workDate} — ${batch.length} oracle + ${manualBatch.length} manual мөр`,
    );
    // History-д хадгалах
    return this.saveHistory({ name: `${workDate} (auto)`, userId, userName });
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { OracleService } from "../oracle/oracle.service";

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

  constructor(
    private clickhouse: ClickHouseService,
    private oracle: OracleService,
  ) {}

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
  }

  private static readonly DEFAULT_BRANCH_IDS: readonly number[] = [
    110, 116, 117, 120, 123, 124, 130, 140, 141, 150, 160, 170, 171, 173, 174,
    175, 180, 182, 190, 191, 200, 201, 202, 203, 204, 205, 206, 210, 214, 215,
    220, 225, 240, 250, 270, 271, 272, 280, 281, 290, 300, 301, 305, 310, 315,
    320, 321, 325, 330, 340, 345, 361, 363, 365, 366, 367, 369, 400, 401, 402,
    430, 431, 432, 433, 438, 460, 470, 471, 490, 491, 520, 521, 524, 527, 529,
    540, 541, 550, 560, 561, 563, 580, 581, 590, 600, 610, 620, 625, 626,
  ];

  async runBranchRiskass(args: {
    pDate: string;
    pDateBeg: string;
    branchIds?: number[];
    userId?: string;
  }): Promise<{
    pDate: string;
    pDateBeg: string;
    branchCount: number;
    rowCount: number;
    failed: { branchId: number; error: string }[];
    rows: any[];
  }> {
    if (!this.oracle.isConnected()) {
      throw new Error(
        "Oracle холболт тохируулагдаагүй байна. .env файлд ORACLE_USER/ORACLE_PASSWORD/ORACLE_CONNECT_STRING тохируулна уу.",
      );
    }
    const pDate = this.parseYmd(args.pDate);
    const pDateBeg = this.parseYmd(args.pDateBeg);
    const ids =
      args.branchIds && args.branchIds.length > 0
        ? Array.from(new Set(args.branchIds.filter((n) => Number.isFinite(n))))
        : Array.from(RiskAssessmentService.DEFAULT_BRANCH_IDS);

    const failed: { branchId: number; error: string }[] = [];
    const allRows: any[] = [];
    const seen = new Set<string>();
    let firstError: string | null = null;

    const CONCURRENCY = 8;
    const t0 = Date.now();
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= ids.length) return;
        const branchId = ids[i];
        try {
          const rows = await this.oracle.callRefCursorProc<any>(
            "RISKASSESSMENT.BRANCHRISKASS",
            [branchId, pDate, pDateBeg],
            ["RISKASSESSMENT.BRANCHRISKASS"],
          );
          for (const r of rows) {
            const norm = {
              ...r,
              P_DATEBEG: this.toYmd(r.P_DATEBEG ?? r.p_DATEBEG ?? r.BEGINDATE),
              P_DATE: this.toYmd(r.P_DATE ?? r.p_DATE ?? r.ENDDATE),
            };
            const key = [
              norm.SOLID,
              norm.BRANCHID,
              norm.SUBID,
              norm.RESULT,
              norm.DESCRIPTION_TEXT,
            ].join("||");
            if (seen.has(key)) continue;
            seen.add(key);
            allRows.push(norm);
          }
        } catch (e: any) {
          const msg = e?.message || String(e);
          if (!firstError) firstError = msg;
          this.logger.warn(
            `BranchRiskass failed for branchId=${branchId}: ${msg}`,
          );
          failed.push({ branchId, error: msg });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()),
    );
    const elapsedMs = Date.now() - t0;
    this.logger.log(
      `BranchRiskass DONE: ${ids.length} салбар, ${allRows.length} мөр, ${failed.length} алдаа, ${(elapsedMs / 1000).toFixed(1)}s`,
    );
    if (allRows.length === 0 && firstError) {
      this.logger.error(
        `BranchRiskass бүх салбар алдажээ. Анхны алдаа: ${firstError}`,
      );
    }
    const result = {
      pDate: args.pDate,
      pDateBeg: args.pDateBeg,
      branchCount: ids.length,
      rowCount: allRows.length,
      failed,
      rows: allRows,
    };
    if (allRows.length > 0) {
      try {
        await this.saveCurrentOracleRows(result);
      } catch (e: any) {
        this.logger.warn(`Current хадгалахад алдаа: ${e?.message || e}`);
      }
    }
    return result;
  }

  private async saveCurrentOracleRows(result: {
    pDate: string;
    pDateBeg: string;
    rows: any[];
  }): Promise<void> {
    await this.clickhouse.exec(
      `ALTER TABLE risk_assessment_current DELETE WHERE rowType = 'oracle' AND isManual = 0`,
    );
    const fetchedAt = nowCH();
    const batch = result.rows.map((r) => ({
      rowKey: `oracle:${r.BRANCHID ?? ""}:${r.SUBID ?? ""}:${r.SOLID ?? ""}`,
      rowType: "oracle",
      fetchedAt,
      updatedBy: "",
      pDate: result.pDate,
      pDateBeg: result.pDateBeg,
      SOLID: String(r.SOLID ?? ""),
      BRANCHNAME: String(r.BRANCHNAME ?? ""),
      BRANCHID: String(r.BRANCHID ?? ""),
      PARENTBRANCH: String(r.PARENTBRANCH ?? ""),
      RESULT: String(r.RESULT ?? ""),
      RESULT_TYPE: String(r.RESULT_TYPE ?? ""),
      DESCRIPTION_TEXT: String(r.DESCRIPTION_TEXT ?? ""),
      P_DATEBEG: String(r.P_DATEBEG ?? ""),
      P_DATE: String(r.P_DATE ?? ""),
      ID: String(r.ID ?? ""),
      SUBID: String(r.SUBID ?? ""),
      OPERATION_TYPE: String(r.OPERATION_TYPE ?? ""),
      isManual: 0,
      manualResult: "",
      indicatorId: "",
      indicatorValue: null,
    }));
    const CHUNK = 1000;
    for (let i = 0; i < batch.length; i += CHUNK) {
      await this.clickhouse.insert(
        "risk_assessment_current",
        batch.slice(i, i + CHUNK),
      );
    }
    this.logger.log(`saveCurrentOracleRows: ${batch.length} мөр`);
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

  async overrideBranchRiskassRow(
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
    this.logger.log(
      `overrideBranchRiskassRow: ${rowKey} → "${manualResult}" by ${changedBy}`,
    );
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

  private parseYmd(s: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
    if (!m)
      throw new Error(`Огноо буруу формат (YYYY-MM-DD шаардлагатай): ${s}`);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
  }

  private toYmd(d: any): string {
    if (!d) return "";
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    const s = String(d);
    return s.length >= 10 ? s.slice(0, 10) : s;
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
}

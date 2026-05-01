import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import * as oracledb from "oracledb";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { OracleService } from "../oracle/oracle.service";

export interface RiskIndicator {
  id: string;
  code: string;
  name: string;
  category: string;
  weight: number; // 0..1
  sourceType: "auto" | "manual" | "hybrid";
  unit: string;
  isActive: number;
  createdAt: string;
  oracleQuery?: string;
  scoreScale?: number; // multiplier from rawValue → 0..100 score
}

export interface OracleSyncResult {
  period: string;
  ok: boolean;
  upserted: number;
  skippedManual: number;
  perIndicator: { code: string; name: string; rows: number; error?: string }[];
}

export interface RiskScore {
  id: string;
  period: string; // 'YYYY-MM'
  branchId: string;
  branchName: string;
  indicatorId: string;
  rawValue: number | null;
  score: number; // 0..100
  isManual: number; // 1 = manually edited
  note: string;
  updatedBy: string;
  updatedAt: string;
}

export interface BranchSummary {
  period: string;
  branchId: string;
  branchName: string;
  totalScore: number;
  level: "low" | "medium" | "high";
  indicatorCount: number;
  manualCount: number;
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
    await this.seedDefaultIndicators();
  }

  // ── Schema ────────────────────────────────────────────────────────────────
  private async ensureTables() {
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_indicators (
        id          String,
        code        String,
        name        String,
        category    String,
        weight      Float32,
        sourceType  String DEFAULT 'manual',
        unit        String DEFAULT '',
        isActive    UInt8  DEFAULT 1,
        createdAt   DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(createdAt)
        ORDER BY id
    `);

    // Add Oracle integration columns to existing risk_indicators tables
    await this.clickhouse
      .exec(
        `ALTER TABLE risk_indicators ADD COLUMN IF NOT EXISTS oracleQuery String DEFAULT ''`,
      )
      .catch(() => {});
    await this.clickhouse
      .exec(
        `ALTER TABLE risk_indicators ADD COLUMN IF NOT EXISTS scoreScale Float32 DEFAULT 1.0`,
      )
      .catch(() => {});

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_scores (
        id           String,
        period       String,
        branchId     String,
        branchName   String,
        indicatorId  String,
        rawValue     Nullable(Float64),
        score        Float32,
        isManual     UInt8 DEFAULT 0,
        note         String DEFAULT '',
        updatedBy    String DEFAULT '',
        updatedAt    DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY (period, branchId, indicatorId)
    `);

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_audit_log (
        id           String,
        period       String,
        branchId     String,
        indicatorId  String,
        oldValue     Nullable(Float64),
        newValue     Nullable(Float64),
        oldScore     Nullable(Float32),
        newScore     Nullable(Float32),
        reason       String DEFAULT '',
        changedBy    String,
        changedAt    DateTime DEFAULT now()
      ) ENGINE = MergeTree()
        ORDER BY (changedAt, branchId)
    `);

    // BranchRiskass-н сүүлийн үр дүнг хэрэглэгч тус бүрт кэшлэнэ
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_branch_riskass_runs (
        userId       String,
        pDate        String,
        pDateBeg     String,
        branchCount  UInt32,
        rowCount     UInt32,
        failed       String DEFAULT '[]',
        fetchedAt    DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(fetchedAt)
        ORDER BY userId
    `);

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_branch_riskass_rows (
        userId           String,
        rowKey           String,
        SOLID            String,
        BRANCHNAME       String,
        BRANCHID         String,
        PARENTBRANCH     String,
        RESULT           String,
        RESULT_TYPE      String,
        DESCRIPTION_TEXT String,
        P_DATEBEG        String,
        P_DATE           String,
        ID               String,
        SUBID            String,
        OPERATION_TYPE   String,
        fetchedAt        DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(fetchedAt)
        ORDER BY (userId, rowKey)
    `);
  }

  private async seedDefaultIndicators() {
    const existing = await this.clickhouse.query<{ cnt: number }>(
      `SELECT count() AS cnt FROM risk_indicators FINAL WHERE isActive = 1`,
    );
    if (Number(existing[0]?.cnt ?? 0) > 0) return;

    const defaults: Omit<RiskIndicator, "id" | "createdAt">[] = [
      {
        code: "NPL_RATIO",
        name: "Чанаргүй зээлийн харьцаа",
        category: "Зээлийн эрсдэл",
        weight: 0.2,
        sourceType: "auto",
        unit: "%",
        isActive: 1,
      },
      {
        code: "OPS_INCIDENT",
        name: "Үйл ажиллагааны зөрчлийн тоо",
        category: "Үйл ажиллагааны эрсдэл",
        weight: 0.15,
        sourceType: "manual",
        unit: "тоо",
        isActive: 1,
      },
      {
        code: "FRAUD_CASE",
        name: "Луйврын тохиолдол",
        category: "Залилангийн эрсдэл",
        weight: 0.2,
        sourceType: "manual",
        unit: "тоо",
        isActive: 1,
      },
      {
        code: "AML_FLAG",
        name: "AML дохио",
        category: "Хууль зүйн эрсдэл",
        weight: 0.15,
        sourceType: "auto",
        unit: "тоо",
        isActive: 1,
      },
      {
        code: "CUSTOMER_COMPLAINT",
        name: "Харилцагчийн гомдол",
        category: "Үйлчилгээний эрсдэл",
        weight: 0.1,
        sourceType: "manual",
        unit: "тоо",
        isActive: 1,
      },
      {
        code: "STAFF_TURNOVER",
        name: "Ажилтны эргэлт",
        category: "Хүний нөөцийн эрсдэл",
        weight: 0.1,
        sourceType: "manual",
        unit: "%",
        isActive: 1,
      },
      {
        code: "AUDIT_FINDINGS",
        name: "Аудитын илрүүлэлт",
        category: "Хяналтын эрсдэл",
        weight: 0.1,
        sourceType: "manual",
        unit: "оноо",
        isActive: 1,
      },
    ];

    for (const ind of defaults) {
      await this.clickhouse.insert("risk_indicators", [
        { id: randomUUID(), ...ind, createdAt: nowCH() },
      ]);
    }
    this.logger.log(`Seeded ${defaults.length} default risk indicators`);
  }

  // ── Indicators ────────────────────────────────────────────────────────────
  async listIndicators(): Promise<RiskIndicator[]> {
    return this.clickhouse.query<RiskIndicator>(
      `SELECT id, code, name, category, weight, sourceType, unit, isActive,
              toString(createdAt) AS createdAt,
              oracleQuery, scoreScale
       FROM risk_indicators FINAL
       WHERE isActive = 1
       ORDER BY category, name`,
    );
  }

  async updateIndicator(
    id: string,
    patch: { oracleQuery?: string; scoreScale?: number; weight?: number },
  ): Promise<void> {
    const sets: string[] = [];
    const params: Record<string, any> = { id };
    if (patch.oracleQuery !== undefined) {
      sets.push(`oracleQuery = {oq:String}`);
      params.oq = patch.oracleQuery;
    }
    if (patch.scoreScale !== undefined) {
      sets.push(`scoreScale = {ss:Float32}`);
      params.ss = patch.scoreScale;
    }
    if (patch.weight !== undefined) {
      sets.push(`weight = {w:Float32}`);
      params.w = patch.weight;
    }
    if (sets.length === 0) return;
    await this.clickhouse.exec(
      `ALTER TABLE risk_indicators UPDATE ${sets.join(", ")} WHERE id = {id:String}`,
      params,
    );
  }

  async createIndicator(
    data: Omit<RiskIndicator, "id" | "createdAt" | "isActive">,
  ): Promise<RiskIndicator> {
    const row: RiskIndicator = {
      id: randomUUID(),
      ...data,
      isActive: 1,
      createdAt: nowCH(),
    };
    await this.clickhouse.insert("risk_indicators", [row]);
    return row;
  }

  async deleteIndicator(id: string): Promise<void> {
    await this.clickhouse.exec(
      `ALTER TABLE risk_indicators UPDATE isActive = 0 WHERE id = {id:String}`,
      { id },
    );
  }

  // ── Scores ────────────────────────────────────────────────────────────────
  /**
   * Get all scores for the given period (one row per branch+indicator).
   */
  async listScores(period: string): Promise<RiskScore[]> {
    return this.clickhouse.query<RiskScore>(
      `SELECT id, period, branchId, branchName, indicatorId,
              rawValue, score, isManual, note, updatedBy,
              toString(updatedAt) AS updatedAt
       FROM risk_scores FINAL
       WHERE period = {period:String}
       ORDER BY branchName, indicatorId`,
      { period },
    );
  }

  /**
   * Manual edit: upsert one score for a branch+indicator combination.
   */
  async upsertScore(args: {
    period: string;
    branchId: string;
    branchName: string;
    indicatorId: string;
    rawValue: number | null;
    score: number;
    note?: string;
    reason?: string;
    userId: string;
  }): Promise<RiskScore> {
    // Read previous (for audit log)
    const prev = await this.clickhouse.query<{
      rawValue: number | null;
      score: number;
    }>(
      `SELECT rawValue, score
       FROM risk_scores FINAL
       WHERE period = {p:String} AND branchId = {b:String} AND indicatorId = {i:String}
       LIMIT 1`,
      { p: args.period, b: args.branchId, i: args.indicatorId },
    );
    const prevRow = prev[0];

    const id =
      // Reuse existing row id when present so ReplacingMergeTree dedupes
      (
        await this.clickhouse.query<{ id: string }>(
          `SELECT id FROM risk_scores FINAL
           WHERE period = {p:String} AND branchId = {b:String} AND indicatorId = {i:String}
           LIMIT 1`,
          { p: args.period, b: args.branchId, i: args.indicatorId },
        )
      )[0]?.id ?? randomUUID();

    const row: RiskScore = {
      id,
      period: args.period,
      branchId: args.branchId,
      branchName: args.branchName,
      indicatorId: args.indicatorId,
      rawValue: args.rawValue,
      score: this.clamp(args.score, 0, 100),
      isManual: 1,
      note: args.note ?? "",
      updatedBy: args.userId,
      updatedAt: nowCH(),
    };
    await this.clickhouse.insert("risk_scores", [row]);

    // Audit
    await this.clickhouse.insert("risk_audit_log", [
      {
        id: randomUUID(),
        period: args.period,
        branchId: args.branchId,
        indicatorId: args.indicatorId,
        oldValue: prevRow?.rawValue ?? null,
        newValue: args.rawValue,
        oldScore: prevRow?.score ?? null,
        newScore: row.score,
        reason: args.reason ?? "",
        changedBy: args.userId,
        changedAt: nowCH(),
      },
    ]);

    return row;
  }

  /**
   * Aggregated summary per branch for a period: weighted total + level.
   */
  async getSummary(period: string): Promise<BranchSummary[]> {
    const rows = await this.clickhouse.query<{
      branchId: string;
      branchName: string;
      totalScore: number;
      indicatorCount: number;
      manualCount: number;
    }>(
      `SELECT
         s.branchId   AS branchId,
         any(s.branchName) AS branchName,
         sum(s.score * i.weight) AS totalScore,
         count() AS indicatorCount,
         sum(s.isManual) AS manualCount
       FROM (
         SELECT branchId, branchName, score, isManual, indicatorId
         FROM risk_scores FINAL
         WHERE period = {period:String}
       ) AS s
       INNER JOIN (
         SELECT id, weight FROM risk_indicators FINAL WHERE isActive = 1
       ) AS i ON i.id = s.indicatorId
       GROUP BY s.branchId
       ORDER BY totalScore DESC`,
      { period },
    );

    return rows.map((r) => ({
      period,
      branchId: r.branchId,
      branchName: r.branchName,
      totalScore: Number(r.totalScore ?? 0),
      indicatorCount: Number(r.indicatorCount ?? 0),
      manualCount: Number(r.manualCount ?? 0),
      level: this.classify(Number(r.totalScore ?? 0)),
    }));
  }

  /**
   * Audit history for a single cell (branch + indicator within period).
   */
  async getAuditLog(
    period: string,
    branchId: string,
    indicatorId: string,
  ): Promise<any[]> {
    return this.clickhouse.query(
      `SELECT id, oldValue, newValue, oldScore, newScore, reason, changedBy,
              toString(changedAt) AS changedAt
       FROM risk_audit_log
       WHERE period = {p:String} AND branchId = {b:String} AND indicatorId = {i:String}
       ORDER BY changedAt DESC
       LIMIT 100`,
      { p: period, b: branchId, i: indicatorId },
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private clamp(n: number, lo: number, hi: number): number {
    if (Number.isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  private classify(total: number): "low" | "medium" | "high" {
    if (total >= 70) return "high";
    if (total >= 40) return "medium";
    return "low";
  }

  // ── Oracle sync ───────────────────────────────────────────────────────────
  /**
   * Pull raw values per branch from Oracle for each auto/hybrid indicator that
   * has an `oracleQuery` configured. Existing manual edits are preserved.
   *
   * Each indicator query MUST return columns: BRANCH_ID, BRANCH_NAME, RAW_VALUE.
   * Available bind params: :period (YYYY-MM), :period_start (DATE), :period_end (DATE).
   */
  async syncFromOracle(
    period: string,
    userId: string,
  ): Promise<OracleSyncResult> {
    if (!this.oracle.isConnected()) {
      throw new Error(
        "Oracle холболт тохируулагдаагүй байна. .env файлд ORACLE_USER/ORACLE_PASSWORD/ORACLE_CONNECT_STRING тохируулна уу.",
      );
    }

    const { startDate, endDate } = this.periodRange(period);
    const allIndicators = await this.listIndicators();
    const indicators = allIndicators.filter(
      (i) =>
        (i.sourceType === "auto" || i.sourceType === "hybrid") &&
        i.oracleQuery &&
        i.oracleQuery.trim().length > 0,
    );

    this.logger.log(
      `[syncFromOracle] period=${period} range=${startDate.toISOString()}..${endDate.toISOString()} ` +
        `totalIndicators=${allIndicators.length} eligible=${indicators.length}`,
    );
    if (indicators.length === 0) {
      const reasons = allIndicators.map((i) => {
        if (i.sourceType !== "auto" && i.sourceType !== "hybrid")
          return `${i.code}: sourceType=${i.sourceType} (manual)`;
        if (!i.oracleQuery || !i.oracleQuery.trim())
          return `${i.code}: oracleQuery хоосон`;
        return `${i.code}: OK`;
      });
      this.logger.warn(
        `[syncFromOracle] Татах индикатор олдсонгүй. Шалтгаан:\n  - ${reasons.join("\n  - ")}`,
      );
    } else {
      this.logger.log(
        `[syncFromOracle] Eligible indicators: ${indicators.map((i) => i.code).join(", ")}`,
      );
    }

    // Cache: existing manual rows for the period
    const existing = await this.clickhouse.query<{
      branchId: string;
      indicatorId: string;
      isManual: number;
      id: string;
    }>(
      `SELECT id, branchId, indicatorId, isManual
       FROM risk_scores FINAL
       WHERE period = {p:String}`,
      { p: period },
    );
    const manualSet = new Set(
      existing
        .filter((r) => Number(r.isManual) === 1)
        .map((r) => `${r.branchId}::${r.indicatorId}`),
    );
    const idMap = new Map(
      existing.map((r) => [`${r.branchId}::${r.indicatorId}`, r.id]),
    );

    const result: OracleSyncResult = {
      period,
      ok: true,
      upserted: 0,
      skippedManual: 0,
      perIndicator: [],
    };

    for (const ind of indicators) {
      try {
        this.logger.log(
          `[syncFromOracle] ${ind.code} → query ажиллуулж байна... (binds: period=${period}, start=${startDate.toISOString()}, end=${endDate.toISOString()})`,
        );
        const rows = await this.oracle.query<{
          BRANCH_ID: string | number;
          BRANCH_NAME: string;
          RAW_VALUE: number | null;
        }>(ind.oracleQuery!, [period, startDate, endDate]);

        this.logger.log(
          `[syncFromOracle] ${ind.code} → Oracle буцаасан мөр: ${rows.length}` +
            (rows.length > 0
              ? ` (sample: ${JSON.stringify(rows[0])})`
              : " (хоосон үр дүн)"),
        );

        let inserted = 0;
        let skippedNoBranch = 0;
        for (const r of rows) {
          const branchId = String(r.BRANCH_ID ?? "").trim();
          const branchName = String(r.BRANCH_NAME ?? "").trim();
          if (!branchId) {
            skippedNoBranch++;
            continue;
          }

          const key = `${branchId}::${ind.id}`;
          if (manualSet.has(key)) {
            result.skippedManual++;
            continue;
          }

          const rawValue = r.RAW_VALUE == null ? null : Number(r.RAW_VALUE);
          const scale = Number(ind.scoreScale ?? 1);
          const score = this.clamp((rawValue ?? 0) * scale, 0, 100);

          const row: RiskScore = {
            id: idMap.get(key) ?? randomUUID(),
            period,
            branchId,
            branchName,
            indicatorId: ind.id,
            rawValue,
            score,
            isManual: 0,
            note: "Oracle sync",
            updatedBy: userId,
            updatedAt: nowCH(),
          };
          await this.clickhouse.insert("risk_scores", [row]);
          inserted++;
        }

        if (skippedNoBranch > 0) {
          this.logger.warn(
            `[syncFromOracle] ${ind.code} → ${skippedNoBranch} мөр BRANCH_ID хоосон тул алгассан`,
          );
        }
        this.logger.log(
          `[syncFromOracle] ${ind.code} → upserted=${inserted}`,
        );

        result.upserted += inserted;
        result.perIndicator.push({
          code: ind.code,
          name: ind.name,
          rows: inserted,
        });
      } catch (e: any) {
        this.logger.error(
          `[syncFromOracle] ${ind.code} FAILED: ${e.message}\nQuery:\n${ind.oracleQuery}`,
        );
        result.ok = false;
        result.perIndicator.push({
          code: ind.code,
          name: ind.name,
          rows: 0,
          error: e.message,
        });
      }
    }

    this.logger.log(
      `[syncFromOracle] DONE period=${period} upserted=${result.upserted} skippedManual=${result.skippedManual} ok=${result.ok}`,
    );
    return result;
  }

  private periodRange(period: string): { startDate: Date; endDate: Date } {
    const m = /^(\d{4})-(\d{2})$/.exec(period);
    if (!m) throw new Error("period must be 'YYYY-MM'");
    const year = Number(m[1]);
    const month = Number(m[2]);
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1)); // exclusive next month
    return { startDate, endDate };
  }

  // ── BranchRiskass (Oracle stored procedure) ───────────────────────────────
  /**
   * RISKASSESSMENT.BranchRiskass procedure-ийг бүх (эсвэл өгөгдсөн) салбарт
   * дуудаж нэгтгэсэн үр дүнг буцаана. SUBID 1..35 хүртэлх үнэлгээний мөрүүдийг
   * нэг salbar тус бүрд үүсгэнэ.
   */
  private static readonly DEFAULT_BRANCH_IDS: readonly number[] = [
    110, 116, 117, 120, 123, 124, 130, 140, 141, 150, 160, 170, 171, 173, 174,
    175, 180, 182, 190, 191, 200, 201, 202, 203, 204, 205, 206, 210, 214, 215,
    220, 225, 240, 250, 270, 271, 272, 280, 281, 290, 300, 301, 305, 310, 315,
    320, 321, 325, 330, 340, 345, 361, 363, 365, 366, 367, 369, 400, 401, 402,
    430, 431, 432, 433, 438, 460, 470, 471, 490, 491, 520, 521, 524, 527, 529,
    540, 541, 550, 560, 561, 563, 580, 581, 590, 600, 610, 620, 625, 626,
  ];

  async runBranchRiskass(args: {
    pDate: string; // 'YYYY-MM-DD'
    pDateBeg: string; // 'YYYY-MM-DD'
    branchIds?: number[];
    userId?: string;
  }): Promise<{
    pDate: string;
    pDateBeg: string;
    branchCount: number;
    rowCount: number;
    failed: { branchId: number; error: string }[];
    rows: Array<{
      SOLID: number | string;
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
    }>;
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
    const seen = new Set<string>(); // dedup like pandas .drop_duplicates()
    let firstError: string | null = null;

    // Параллел дуудна (Oracle pool poolMax=10 тул 8-аар хязгаарлав)
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
      `BranchRiskass DONE: ${ids.length} салбар, ${allRows.length} мөр, ` +
        `${failed.length} алдаа, ${(elapsedMs / 1000).toFixed(1)}s ` +
        `(p_DATE=${pDate.toString()}, p_DATEBEG=${pDateBeg.toString()})`,
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

    // ClickHouse-д хадгалах (хэрэглэгч тус бүрт сүүлийн үр дүн)
    if (args.userId && allRows.length > 0) {
      try {
        await this.saveBranchRiskassCache(args.userId, result);
      } catch (e: any) {
        this.logger.warn(
          `BranchRiskass cache хадгалахад алдаа: ${e?.message || e}`,
        );
      }
    }

    return result;
  }

  /**
   * Хэрэглэгчийн өмнөх дуудлагын үр дүнг ClickHouse-д хадгална.
   * Хуучин кэшийг устгаад шинээр оруулна.
   */
  private async saveBranchRiskassCache(
    userId: string,
    result: {
      pDate: string;
      pDateBeg: string;
      branchCount: number;
      rowCount: number;
      failed: { branchId: number; error: string }[];
      rows: any[];
    },
  ): Promise<void> {
    // Хуучин кэшийг устгах
    await this.clickhouse.exec(
      `ALTER TABLE risk_branch_riskass_rows DELETE WHERE userId = {u:String}`,
      { u: userId },
    );
    await this.clickhouse.exec(
      `ALTER TABLE risk_branch_riskass_runs DELETE WHERE userId = {u:String}`,
      { u: userId },
    );

    // Run metadata
    await this.clickhouse.insert("risk_branch_riskass_runs", [
      {
        userId,
        pDate: result.pDate,
        pDateBeg: result.pDateBeg,
        branchCount: result.branchCount,
        rowCount: result.rowCount,
        failed: JSON.stringify(result.failed ?? []),
        fetchedAt: nowCH(),
      },
    ]);

    // Мөрүүд (1000-аар хэсэгчилж insert)
    if (result.rows.length === 0) return;
    const fetchedAt = nowCH();
    const batch = result.rows.map((r, i) => ({
      userId,
      rowKey: `${r.BRANCHID ?? ""}|${r.SUBID ?? ""}|${i}`,
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
      fetchedAt,
    }));
    const CHUNK = 1000;
    for (let i = 0; i < batch.length; i += CHUNK) {
      await this.clickhouse.insert(
        "risk_branch_riskass_rows",
        batch.slice(i, i + CHUNK),
      );
    }
    this.logger.log(
      `BranchRiskass cache: userId=${userId}, ${batch.length} мөр хадгалав`,
    );
  }

  /**
   * Хэрэглэгчийн сүүлд хадгалсан BranchRiskass үр дүнг буцаана.
   * Хэрэв байхгүй бол null.
   */
  async getLastBranchRiskass(userId: string): Promise<{
    pDate: string;
    pDateBeg: string;
    branchCount: number;
    rowCount: number;
    failed: { branchId: number; error: string }[];
    rows: any[];
    fetchedAt: string;
  } | null> {
    const runs = await this.clickhouse.query<{
      pDate: string;
      pDateBeg: string;
      branchCount: number;
      rowCount: number;
      failed: string;
      fetchedAt: string;
    }>(
      `SELECT pDate, pDateBeg, branchCount, rowCount, failed,
              toString(fetchedAt) AS fetchedAt
       FROM risk_branch_riskass_runs FINAL
       WHERE userId = {u:String}
       LIMIT 1`,
      { u: userId },
    );
    if (runs.length === 0) return null;
    const run = runs[0];

    const rows = await this.clickhouse.query<any>(
      `SELECT SOLID, BRANCHNAME, BRANCHID, PARENTBRANCH, RESULT, RESULT_TYPE,
              DESCRIPTION_TEXT, P_DATEBEG, P_DATE, ID, SUBID, OPERATION_TYPE
       FROM risk_branch_riskass_rows FINAL
       WHERE userId = {u:String}
       ORDER BY BRANCHNAME, toUInt32OrZero(SUBID)`,
      { u: userId },
    );

    let failed: { branchId: number; error: string }[] = [];
    try {
      failed = JSON.parse(run.failed || "[]");
    } catch {
      failed = [];
    }

    return {
      pDate: run.pDate,
      pDateBeg: run.pDateBeg,
      branchCount: Number(run.branchCount ?? 0),
      rowCount: Number(run.rowCount ?? 0),
      failed,
      rows,
      fetchedAt: run.fetchedAt,
    };
  }

  private parseYmd(s: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
    if (!m) throw new Error(`Огноо буруу формат (YYYY-MM-DD шаардлагатай): ${s}`);
    // Python cx_Oracle.Timestamp шиг локал TZ-аар үүсгэнэ (UTC биш) —
    // Oracle сервер локал time-аар TDATE хадгалдаг тул өдрийн шилжилтээс зайлсхийнэ.
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
  }

  private toYmd(d: any): string {
    if (!d) return "";
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    const s = String(d);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
}

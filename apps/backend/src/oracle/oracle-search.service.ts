import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { OracleService } from "./oracle.service";
import { OracleConfigService } from "./oracle-config.service";
import { errMessage } from "../common/utils/error-message";

// [PERF] short-TTL cache for getAlerts/getDashboardSummaries — both fan out
// an expensive full-table GROUP BY per dashboard on every call.
const ALERTS_CACHE_TTL_MS = 20_000;
const SUMMARIES_CACHE_TTL_MS = 20_000;
const CIF_SEARCH_ROW_CAP = 1_000;

// ML dashboard-уудыг стандарт дүнгийн тооцооллоос хасна (давхардлаас сэргийлэх)
// DB1-4 (стандарт) болон DB13-16 (ML) нь ижил гүйлгээг илэрхийлдэг
const ML_DASH_IDS_SET = new Set([13, 14, 15, 16]);

type AggRow = { CIF_VAL: string; CNT: number; TOTAL_AMT: number };

/** CIF-ийг зөвхөн үсэг, тоо болгож 30 тэмдэгтээр хязгаарлана */
const sanitizeCif = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 30);

const reasonMessage = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);

/**
 * Alert Box-ийн Oracle уншилт. Хүснэгт/баганын нэрс нь superadmin-ий
 * тохиргооноос ирдэг бөгөөд OracleConfigService хадгалах болон унших үедээ
 * `IDENT_RE` / `validateFromClause`-аар шалгадаг — энд зөвхөн шалгагдсан
 * тохиргоог ашиглана. Утгууд (CIF, огноо, limit) үргэлж bind параметр.
 */
@Injectable()
export class OracleSearchService {
  private readonly logger = new Logger(OracleSearchService.name);
  private alertsCache = new Map<string, { data: unknown; loadedAt: number }>();
  private summariesCache: { data: unknown; loadedAt: number } | null = null;

  constructor(
    private readonly oracle: OracleService,
    private readonly config: OracleConfigService,
  ) {}

  private requireOracle() {
    if (this.oracle.isAuthFailed()) {
      // Нууц үг буруу/lock — дахин оролдохгүй (account lock-аас хамгаална)
      throw new HttpException(
        "Oracle нэвтрэх мэдээлэл буруу байна. Account lock-аас хамгаалж уншилтыг зогсоов. Админд хандана уу.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!this.oracle.isConnected()) {
      throw new HttpException(
        "Oracle холболт тохируулагдаагүй байна",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async listDashboards() {
    await this.config.reloadFromClickHouse();
    return this.config.loadDashboards().map((d) => ({
      id: d.id,
      name: d.name,
      tableName: d.tableName,
      cifColumn: d.cifColumn,
      dateColumn: d.dateColumn,
      amountColumn: d.amountColumn,
      enabled: d.enabled,
    }));
  }

  async searchByCif(cif: string, dateFrom: string, dateTo: string) {
    this.requireOracle();
    await this.config.reloadFromClickHouse();

    if (!cif || typeof cif !== "string") {
      throw new HttpException("CIF дугаар оруулна уу", HttpStatus.BAD_REQUEST);
    }
    const safeCif = sanitizeCif(cif);
    if (!safeCif)
      throw new HttpException("CIF дугаар буруу байна", HttpStatus.BAD_REQUEST);

    const dashboards = this.config.getEnabledDashboards();
    const results: {
      dashboardId: number;
      dashboardName: string;
      table: string;
      matchCount: number;
      totalAmount: number;
      truncated?: boolean;
      rows: Record<string, unknown>[];
    }[] = [];

    const settled = await Promise.allSettled(
      dashboards.map(async (dash) => {
        const fromExpr = dash.fromClause ?? dash.tableName;
        let sql = `SELECT * FROM ${fromExpr} WHERE ${dash.cifColumn} = :cif`;
        const params: string[] = [safeCif];

        if (dateFrom && dash.dateColumn) {
          sql += ` AND ${dash.dateColumn} >= TO_DATE(:dfrom, 'YYYY-MM-DD')`;
          params.push(dateFrom.substring(0, 10));
        }
        if (dateTo && dash.dateColumn) {
          sql += ` AND ${dash.dateColumn} <= TO_DATE(:dto, 'YYYY-MM-DD')`;
          params.push(dateTo.substring(0, 10));
        }
        sql += ` AND ROWNUM <= ${CIF_SEARCH_ROW_CAP + 1}`;

        const rows = await this.oracle.query<Record<string, unknown>>(
          sql,
          params,
          { maxRows: CIF_SEARCH_ROW_CAP + 1 },
        );
        if (rows.length === 0) return null;
        const truncated = rows.length > CIF_SEARCH_ROW_CAP;
        if (truncated) rows.length = CIF_SEARCH_ROW_CAP;
        const amountColumn = dash.amountColumn;
        const totalAmount = amountColumn
          ? rows.reduce((s, r) => s + (Number(r[amountColumn]) || 0), 0)
          : 0;
        return {
          dashboardId: dash.id,
          dashboardName: dash.name,
          table: dash.tableName,
          matchCount: rows.length,
          totalAmount,
          truncated,
          rows,
        };
      }),
    );

    settled.forEach((s, i) => {
      if (s.status === "fulfilled" && s.value) {
        results.push(s.value);
      } else if (s.status === "rejected") {
        this.logger.warn(
          `DB${dashboards[i].id} CIF query failed: ${reasonMessage(s.reason)}`,
        );
      }
    });

    results.sort((a, b) => b.matchCount - a.matchCount);

    return {
      cif: safeCif,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      totalDashboards: results.length,
      totalMatches: results.reduce((s, r) => s + r.matchCount, 0),
      results,
    };
  }

  async getAlerts(minDash: string, limitStr: string, cifFilter: string) {
    this.requireOracle();
    await this.config.reloadFromClickHouse();

    const minDashboards = Math.max(2, parseInt(minDash) || 2);
    // [AUDIT] Дээд тааз — limit=99999999 маягийн дуудлага Node санах ойг
    // дүүргэхээс сэргийлнэ. 10000-аас олон alert-ийг UI-д харуулах хэрэглээ байхгүй.
    const limit = Math.min(Math.max(parseInt(limitStr) || 10000, 1), 10000);

    // If a specific CIF is requested, search only for that CIF across all dashboards
    const safeCifFilter = cifFilter ? sanitizeCif(cifFilter) : null;

    const cacheKey = `${minDashboards}:${limit}:${safeCifFilter ?? ""}`;
    const cached = this.alertsCache.get(cacheKey);
    if (cached && Date.now() - cached.loadedAt < ALERTS_CACHE_TTL_MS) {
      return cached.data;
    }

    const cifMap: Record<
      string,
      {
        dashboards: {
          id: number;
          name: string;
          count: number;
          totalAmount: number;
        }[];
      }
    > = {};
    const dashboards = this.config.getEnabledDashboards();
    const failedDashboards: { id: number; name: string; error: string }[] = [];

    const dashResults = await Promise.allSettled(
      dashboards.map(async (dash) => {
        const fromExpr = dash.fromClause ?? dash.tableName;
        const amountExpr = dash.amountColumn
          ? `SUM(NVL(${dash.amountColumn}, 0))`
          : "0";
        const select = `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, ${amountExpr} AS TOTAL_AMT FROM ${fromExpr}`;
        const sql = safeCifFilter
          ? `${select} WHERE ${dash.cifColumn} = :cif GROUP BY ${dash.cifColumn}`
          : `${select} GROUP BY ${dash.cifColumn} HAVING COUNT(*) >= 1`;
        const rows = await this.oracle.query<AggRow>(
          sql,
          safeCifFilter ? [safeCifFilter] : [],
        );
        return { dash, rows };
      }),
    );

    dashResults.forEach((s, i) => {
      if (s.status === "rejected") {
        const msg = reasonMessage(s.reason);
        this.logger.warn(`DB${dashboards[i].id} alerts query failed: ${msg}`);
        failedDashboards.push({
          id: dashboards[i].id,
          name: dashboards[i].name,
          error: msg,
        });
        return;
      }
      const { dash, rows } = s.value;
      for (const row of rows) {
        const cifVal = String(row.CIF_VAL || "").trim();
        if (!cifVal) continue;
        if (!cifMap[cifVal]) cifMap[cifVal] = { dashboards: [] };
        cifMap[cifVal].dashboards.push({
          id: dash.id,
          name: dash.name,
          count: Number(row.CNT) || 0,
          totalAmount: Number(row.TOTAL_AMT) || 0,
        });
      }
    });

    const alerts = Object.entries(cifMap)
      .filter(
        ([, v]) => v.dashboards.length >= (safeCifFilter ? 1 : minDashboards),
      )
      .map(([cif, v]) => {
        const stdAmount = v.dashboards
          .filter((d) => !ML_DASH_IDS_SET.has(d.id))
          .reduce((s, d) => s + d.totalAmount, 0);
        const mlAmount = v.dashboards
          .filter((d) => ML_DASH_IDS_SET.has(d.id))
          .reduce((s, d) => s + d.totalAmount, 0);
        return {
          cif,
          dashboardCount: v.dashboards.length,
          totalTransactions: v.dashboards.reduce((s, d) => s + d.count, 0),
          totalAmount: stdAmount,
          mlAmount,
          dashboards: v.dashboards.sort((a, b) => b.count - a.count),
        };
      })
      .sort(
        (a, b) =>
          b.dashboardCount - a.dashboardCount || b.totalAmount - a.totalAmount,
      )
      .slice(0, safeCifFilter ? 1 : limit);

    const result = {
      minDashboards,
      totalAlerts: alerts.length,
      alerts,
      failedDashboards,
      searchedCif: safeCifFilter || null,
    };

    // Only cache clean results — avoid serving a transient Oracle failure.
    if (failedDashboards.length === 0) {
      this.alertsCache.set(cacheKey, { data: result, loadedAt: Date.now() });
    }
    return result;
  }

  async getDashboardSummaries() {
    this.requireOracle();

    if (
      this.summariesCache &&
      Date.now() - this.summariesCache.loadedAt < SUMMARIES_CACHE_TTL_MS
    ) {
      return this.summariesCache.data;
    }

    await this.config.reloadFromClickHouse();
    const dashboards = this.config.getEnabledDashboards();

    const results = await Promise.allSettled(
      dashboards.map(async (dash) => {
        const fromExpr = dash.fromClause ?? dash.tableName;
        const amountExpr = dash.amountColumn
          ? `SUM(NVL(${dash.amountColumn}, 0))`
          : "0";
        const rows = await this.oracle.query<{
          CNT: number;
          TOTAL_AMT: number;
        }>(
          `SELECT COUNT(*) AS CNT, ${amountExpr} AS TOTAL_AMT FROM ${fromExpr} WHERE ${dash.cifColumn} IS NOT NULL`,
        );
        const r = rows[0] || { CNT: 0, TOTAL_AMT: 0 };
        return {
          id: dash.id,
          name: dash.name,
          totalCount: Number(r.CNT) || 0,
          totalAmount: Number(r.TOTAL_AMT) || 0,
          hasAmount: !!dash.amountColumn,
        };
      }),
    );

    const summaries = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        id: dashboards[i].id,
        name: dashboards[i].name,
        totalCount: null,
        totalAmount: null,
        hasAmount: !!dashboards[i].amountColumn,
        error: reasonMessage(r.reason),
      };
    });

    // Only cache when every dashboard resolved cleanly.
    if (results.every((r) => r.status === "fulfilled")) {
      this.summariesCache = { data: summaries, loadedAt: Date.now() };
    }
    return summaries;
  }

  async getDashboardTop(idStr: string, limitStr: string, search: string) {
    this.requireOracle();

    const id = parseInt(idStr);
    if (isNaN(id))
      throw new HttpException("id буруу байна", HttpStatus.BAD_REQUEST);

    const dash = this.config.loadDashboards().find((d) => d.id === id);
    if (!dash)
      throw new HttpException("Dashboard олдсонгүй", HttpStatus.NOT_FOUND);
    if (!dash.enabled)
      throw new HttpException("Dashboard идэвхгүй", HttpStatus.BAD_REQUEST);

    const limit = Math.min(Math.max(parseInt(limitStr) || 10, 1), 100);
    const cifCol = dash.cifColumn;
    const fromExpr = dash.fromClause ?? dash.tableName;
    const amountExpr = dash.amountColumn
      ? `SUM(NVL(${dash.amountColumn}, 0))`
      : "0";
    const params: (string | number)[] = [];

    let sql = `SELECT * FROM (
        SELECT ${cifCol} AS CIF_VAL, COUNT(*) AS CNT, ${amountExpr} AS TOTAL_AMT
        FROM ${fromExpr}
        WHERE ${cifCol} IS NOT NULL`;
    const s = search ? sanitizeCif(search) : "";
    if (s) {
      sql += ` AND UPPER(${cifCol}) LIKE UPPER(:srch)`;
      params.push(`%${s}%`);
    }
    sql += ` GROUP BY ${cifCol} ORDER BY ${dash.amountColumn ? "TOTAL_AMT" : "CNT"} DESC) WHERE ROWNUM <= :lmt`;
    params.push(limit);

    let rows: AggRow[];
    try {
      rows = await this.oracle.query<AggRow>(sql, params);
    } catch (err: unknown) {
      // [SEC] AllExceptionsFilter currently masks this behind a generic
      // 422 message, but don't rely on that alone — never construct a
      // payload that embeds the raw SQL/table/schema internals, in case
      // the filter is ever changed or this gets rethrown as user-facing.
      this.logger.warn(
        `Oracle query failed for dashboard ${dash.id} (${dash.tableName}): ${errMessage(err) ?? err}`,
      );
      throw new HttpException(
        "Тайлан татахад алдаа гарлаа. Дахин оролдоно уу.",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      dashboardId: dash.id,
      dashboardName: dash.name,
      tableName: dash.tableName,
      hasAmount: !!dash.amountColumn,
      rows: rows.map((r) => ({
        cif: String(r.CIF_VAL || ""),
        count: Number(r.CNT) || 0,
        totalAmount: Number(r.TOTAL_AMT) || 0,
      })),
    };
  }

  async getRedFlags() {
    this.requireOracle();
    await this.config.reloadFromClickHouse();

    const dashboards = this.config.getEnabledDashboards();

    const settled = await Promise.allSettled(
      dashboards.map(async (dash) => {
        const fromExpr = dash.fromClause ?? dash.tableName;
        const rows = await this.oracle.query<{ CIF_VAL: string }>(
          `SELECT DISTINCT ${dash.cifColumn} AS CIF_VAL FROM ${fromExpr} WHERE ${dash.cifColumn} IS NOT NULL AND ROWNUM <= 50000`,
        );
        return {
          id: dash.id,
          cifs: new Set(
            rows.map((r) => String(r.CIF_VAL || "").trim()).filter(Boolean),
          ),
        };
      }),
    );

    const cifSets: Record<number, Set<string>> = {};
    settled.forEach((result, i) => {
      const dash = dashboards[i];
      if (result.status === "fulfilled") {
        cifSets[result.value.id] = result.value.cifs;
        return;
      }
      this.logger.warn(
        `DB${dash.id} redflag CIF query failed: ${reasonMessage(result.reason)}`,
      );
      cifSets[dash.id] = new Set();
    });

    const chains = this.config.getEnabledChains().map((chain) => {
      const sourceCifs = new Set<string>();
      for (const id of chain.sourceIds) {
        cifSets[id]?.forEach((c) => sourceCifs.add(c));
      }
      const targetCifs = new Set<string>();
      for (const id of chain.targetIds) {
        cifSets[id]?.forEach((c) => targetCifs.add(c));
      }
      const matches = [...sourceCifs].filter((c) => targetCifs.has(c)).sort();

      return {
        id: chain.id,
        name: chain.name,
        description: chain.description,
        sourceLabel: chain.sourceLabel,
        targetLabel: chain.targetLabel,
        sourceIds: chain.sourceIds,
        targetIds: chain.targetIds,
        matchCount: matches.length,
        matches: matches.slice(0, 500),
      };
    });

    return {
      totalChains: chains.length,
      triggeredChains: chains.filter((c) => c.matchCount > 0).length,
      totalMatches: chains.reduce((s, c) => s + c.matchCount, 0),
      chains,
    };
  }
}

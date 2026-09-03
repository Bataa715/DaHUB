import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  Request,
} from "@nestjs/common";
import { OracleService } from "./oracle.service";
import { OracleConfigService } from "./oracle-config.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { ToolGuard } from "../auth/guards/tool.guard";
import { RequireTools } from "../auth/guards/require-tools.decorator";
import { AuditLogService } from "../audit/audit-log.service";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import {
  CreateDashboardDto,
  ReplaceDashboardDto,
  SetEnabledDto,
  CreateChainDto,
  ReplaceChainDto,
} from "./dto/oracle-search.dto";

// [PERF] short-TTL cache for getAlerts/getDashboardSummaries — both fan out
// an expensive full-table GROUP BY per dashboard on every call.
const ALERTS_CACHE_TTL_MS = 20_000;
const SUMMARIES_CACHE_TTL_MS = 20_000;

@UseGuards(JwtAuthGuard, ToolGuard)
@RequireTools("alert_box")
@Controller("oracle/search")
export class OracleSearchController {
  private readonly logger = new Logger(OracleSearchController.name);
  private alertsCache = new Map<
    string,
    { data: unknown; loadedAt: number }
  >();
  private summariesCache: { data: unknown; loadedAt: number } | null = null;

  constructor(
    private readonly oracle: OracleService,
    private readonly config: OracleConfigService,
    private auditLogService: AuditLogService,
  ) {}

  private async logAdminAction(
    req: AuthenticatedRequest,
    action: string,
    status: "success" | "failure",
    metadata?: Record<string, unknown>,
    errorMessage?: string,
  ) {
    await this.auditLogService.log({
      userId: req.user?.id,
      action,
      resource: "oracle_search_config",
      method: action,
      status,
      ...(metadata ? { metadata } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    });
  }

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

  // ─── Admin config (dashboards + event chains) ───────────────────────────────

  /** GET /oracle/search/admin/dashboards — бүх dashboard-ийн бүрэн тохиргоо (admin) */
  @UseGuards(AdminGuard)
  @Get("admin/dashboards")
  async adminGetDashboards() {
    await this.config.reloadFromClickHouse(true);
    return this.config.loadDashboards();
  }

  /** POST /oracle/search/admin/dashboards — шинэ dashboard (admin) */
  @UseGuards(AdminGuard)
  @Post("admin/dashboards")
  async adminCreateDashboard(
    @Body() body: CreateDashboardDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.config.createDashboard(body);
      await this.logAdminAction(req, "oracle_dashboard_create", "success", {
        name: (body as any)?.name,
      });
      return result;
    } catch (err) {
      await this.logAdminAction(
        req,
        "oracle_dashboard_create",
        "failure",
        undefined,
        (err as Error).message,
      );
      if (err instanceof HttpException) throw err;
      throw new HttpException((err as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  /** PUT /oracle/search/admin/dashboards/:id — dashboard засах (admin) */
  @UseGuards(AdminGuard)
  @Put("admin/dashboards/:id")
  async adminReplaceDashboard(
    @Param("id") id: string,
    @Body() body: ReplaceDashboardDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.config.updateDashboard(Number(id), body);
      await this.logAdminAction(req, "oracle_dashboard_update", "success", {
        targetId: id,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.logAdminAction(
        req,
        "oracle_dashboard_update",
        "failure",
        { targetId: id },
        message,
      );
      if (err instanceof HttpException) throw err;
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /** DELETE /oracle/search/admin/dashboards/:id — dashboard устгах (admin) */
  @UseGuards(AdminGuard)
  @Delete("admin/dashboards/:id")
  async adminDeleteDashboard(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      await this.config.deleteDashboard(Number(id));
      await this.logAdminAction(req, "oracle_dashboard_delete", "success", {
        targetId: id,
      });
      return { ok: true };
    } catch (err) {
      await this.logAdminAction(
        req,
        "oracle_dashboard_delete",
        "failure",
        { targetId: id },
        (err as Error).message,
      );
      if (err instanceof HttpException) throw err;
      throw new HttpException((err as Error).message, HttpStatus.NOT_FOUND);
    }
  }

  /** PATCH /oracle/search/admin/dashboards/:id — dashboard идэвхтэй эсэхийг өөрчлөх (admin) */
  @UseGuards(AdminGuard)
  @Patch("admin/dashboards/:id")
  async adminUpdateDashboard(
    @Param("id") id: string,
    @Body() body: SetEnabledDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.config.setDashboardEnabled(
        Number(id),
        body.enabled,
      );
      await this.logAdminAction(req, "oracle_dashboard_set_enabled", "success", {
        targetId: id,
        enabled: body.enabled,
      });
      return result;
    } catch (err) {
      await this.logAdminAction(
        req,
        "oracle_dashboard_set_enabled",
        "failure",
        { targetId: id },
        (err as Error).message,
      );
      if (err instanceof HttpException) throw err;
      throw new HttpException((err as Error).message, HttpStatus.NOT_FOUND);
    }
  }

  /** GET /oracle/search/admin/chains — бүх event chain-ийн бүрэн тохиргоо (admin) */
  @UseGuards(AdminGuard)
  @Get("admin/chains")
  async adminGetChains() {
    await this.config.reloadFromClickHouse(true);
    return this.config.loadChains();
  }

  /** POST /oracle/search/admin/chains — шинэ event chain (admin) */
  @UseGuards(AdminGuard)
  @Post("admin/chains")
  async adminCreateChain(
    @Body() body: CreateChainDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.config.createChain(body);
      await this.logAdminAction(req, "oracle_chain_create", "success", {
        name: (body as any)?.name,
      });
      return result;
    } catch (err) {
      await this.logAdminAction(
        req,
        "oracle_chain_create",
        "failure",
        undefined,
        (err as Error).message,
      );
      if (err instanceof HttpException) throw err;
      throw new HttpException((err as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  /** PUT /oracle/search/admin/chains/:id — event chain засах (admin) */
  @UseGuards(AdminGuard)
  @Put("admin/chains/:id")
  async adminReplaceChain(
    @Param("id") id: string,
    @Body() body: ReplaceChainDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.config.updateChain(Number(id), body);
      await this.logAdminAction(req, "oracle_chain_update", "success", {
        targetId: id,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.logAdminAction(
        req,
        "oracle_chain_update",
        "failure",
        { targetId: id },
        message,
      );
      if (err instanceof HttpException) throw err;
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /** DELETE /oracle/search/admin/chains/:id — event chain устгах (admin) */
  @UseGuards(AdminGuard)
  @Delete("admin/chains/:id")
  async adminDeleteChain(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      await this.config.deleteChain(Number(id));
      await this.logAdminAction(req, "oracle_chain_delete", "success", {
        targetId: id,
      });
      return { ok: true };
    } catch (err) {
      await this.logAdminAction(
        req,
        "oracle_chain_delete",
        "failure",
        { targetId: id },
        (err as Error).message,
      );
      if (err instanceof HttpException) throw err;
      throw new HttpException((err as Error).message, HttpStatus.NOT_FOUND);
    }
  }

  /** PATCH /oracle/search/admin/chains/:id — event chain идэвхтэй эсэхийг өөрчлөх (admin) */
  @UseGuards(AdminGuard)
  @Patch("admin/chains/:id")
  async adminUpdateChain(
    @Param("id") id: string,
    @Body() body: SetEnabledDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.config.setChainEnabled(
        Number(id),
        body.enabled,
      );
      await this.logAdminAction(req, "oracle_chain_set_enabled", "success", {
        targetId: id,
        enabled: body.enabled,
      });
      return result;
    } catch (err) {
      await this.logAdminAction(
        req,
        "oracle_chain_set_enabled",
        "failure",
        { targetId: id },
        (err as Error).message,
      );
      if (err instanceof HttpException) throw err;
      throw new HttpException((err as Error).message, HttpStatus.NOT_FOUND);
    }
  }

  /** GET /oracle/search/dashboards — all dashboard configs (id, name, table, enabled) */
  @Get("dashboards")
  async getDashboards() {
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

  /**
   * GET /api/oracle/search/cif?cif=R12345&from=2025-01-01&to=2026-04-09
   */
  @Get("cif")
  async searchByCif(
    @Query("cif") cif: string,
    @Query("from") dateFrom: string,
    @Query("to") dateTo: string,
  ) {
    this.requireOracle();
    await this.config.reloadFromClickHouse();

    if (!cif || typeof cif !== "string") {
      throw new HttpException("CIF дугаар оруулна уу", HttpStatus.BAD_REQUEST);
    }

    const safeCif = cif
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 30);
    if (!safeCif)
      throw new HttpException("CIF дугаар буруу байна", HttpStatus.BAD_REQUEST);

    const dashboards = this.config.getEnabledDashboards();
    const results: {
      dashboardId: number;
      dashboardName: string;
      table: string;
      matchCount: number;
      totalAmount: number;
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

        const rows = await this.oracle.query(sql, params);
        if (rows.length > 0) {
          const totalAmount = dash.amountColumn
            ? rows.reduce(
                (s, r) =>
                  s +
                  (Number((r as Record<string, unknown>)[dash.amountColumn!]) ||
                    0),
                0,
              )
            : 0;
          return {
            dashboardId: dash.id,
            dashboardName: dash.name,
            table: dash.tableName,
            matchCount: rows.length,
            totalAmount,
            rows: rows as Record<string, unknown>[],
          };
        }
        return null;
      }),
    );

    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === "fulfilled" && s.value) {
        results.push(s.value);
      } else if (s.status === "rejected") {
        this.logger.warn(
          `DB${dashboards[i].id} CIF query failed: ${(s.reason as Error).message}`,
        );
      }
    }

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

  /**
   * GET /api/oracle/search/alerts?min_dashboards=2&limit=200
   */
  @Get("alerts")
  async getAlerts(
    @Query("min_dashboards") minDash: string,
    @Query("limit") limitStr: string,
    @Query("cif") cifFilter: string,
  ) {
    this.requireOracle();
    await this.config.reloadFromClickHouse();

    const minDashboards = Math.max(2, parseInt(minDash) || 2);
    // [AUDIT] Дээд тааз — limit=99999999 маягийн дуудлага Node санах ойг
    // дүүргэхээс сэргийлнэ. 10000-аас олон alert-ийг UI-д харуулах хэрэглээ байхгүй.
    const limit = Math.min(Math.max(parseInt(limitStr) || 10000, 1), 10000);

    // If a specific CIF is requested, search only for that CIF across all dashboards
    const safeCifFilter = cifFilter
      ? cifFilter
          .trim()
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 30)
      : null;

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
        let sql: string;
        let params: string[] = [];
        const fromExpr = dash.fromClause ?? dash.tableName;
        if (safeCifFilter) {
          sql = dash.amountColumn
            ? `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, SUM(NVL(${dash.amountColumn}, 0)) AS TOTAL_AMT FROM ${fromExpr} WHERE ${dash.cifColumn} = :cif GROUP BY ${dash.cifColumn}`
            : `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, 0 AS TOTAL_AMT FROM ${fromExpr} WHERE ${dash.cifColumn} = :cif GROUP BY ${dash.cifColumn}`;
          params = [safeCifFilter];
        } else {
          sql = dash.amountColumn
            ? `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, SUM(NVL(${dash.amountColumn}, 0)) AS TOTAL_AMT FROM ${fromExpr} GROUP BY ${dash.cifColumn} HAVING COUNT(*) >= 1`
            : `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, 0 AS TOTAL_AMT FROM ${fromExpr} GROUP BY ${dash.cifColumn} HAVING COUNT(*) >= 1`;
        }
        const rows = await this.oracle.query<{
          CIF_VAL: string;
          CNT: number;
          TOTAL_AMT: number;
        }>(sql, params);
        return { dash, rows };
      }),
    );

    for (let i = 0; i < dashResults.length; i++) {
      const s = dashResults[i];
      if (s.status === "rejected") {
        const msg = (s.reason as Error)?.message || String(s.reason);
        this.logger.warn(`DB${dashboards[i].id} alerts query failed: ${msg}`);
        failedDashboards.push({
          id: dashboards[i].id,
          name: dashboards[i].name,
          error: msg,
        });
        continue;
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
    }

    // ML dashboard-уудыг стандарт дүнгийн тооцооллоос хасна (давхардлаас сэргийлэх)
    // DB1-4 (стандарт) болон DB13-16 (ML) нь ижил гүйлгээг илэрхийлдэг
    const ML_DASH_IDS_SET = new Set([13, 14, 15, 16]);

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

  /**
   * GET /oracle/search/dashboard-summaries
   * Нийт тоо + нийлбэр дүн — бүх идэвхтэй dashboard
   */
  @Get("dashboard-summaries")
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
        const safeAmt = dash.amountColumn;
        const sql = safeAmt
          ? `SELECT COUNT(*) AS CNT, SUM(NVL(${safeAmt}, 0)) AS TOTAL_AMT FROM ${fromExpr} WHERE ${dash.cifColumn} IS NOT NULL`
          : `SELECT COUNT(*) AS CNT, 0 AS TOTAL_AMT FROM ${fromExpr} WHERE ${dash.cifColumn} IS NOT NULL`;

        const rows = await this.oracle.query<{
          CNT: number;
          TOTAL_AMT: number;
        }>(sql);
        const r = rows[0] || { CNT: 0, TOTAL_AMT: 0 };
        return {
          id: dash.id,
          name: dash.name,
          totalCount: Number(r.CNT) || 0,
          totalAmount: Number(r.TOTAL_AMT) || 0,
          hasAmount: !!safeAmt,
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
        error: String((r.reason as any)?.message ?? r.reason),
      };
    });

    // Only cache when every dashboard resolved cleanly.
    if (results.every((r) => r.status === "fulfilled")) {
      this.summariesCache = { data: summaries, loadedAt: Date.now() };
    }

    return summaries;
  }

  /**
   * GET /oracle/search/dashboard/:id/top?limit=10&search=
   * Top CIFs by count/amount for a single dashboard
   */
  @Get("dashboard/:id/top")
  async getDashboardTop(
    @Param("id") idStr: string,
    @Query("limit") limitStr: string,
    @Query("search") search: string,
  ) {
    this.requireOracle();

    // id comes from path param via @Param but since NestJS uses @Query here we
    // read it from query.  Accept it from both to be flexible.
    // (Controller path is "dashboard/:id/top" so :id is a path param)
    const id = parseInt(idStr);
    if (isNaN(id))
      throw new HttpException("id буруу байна", HttpStatus.BAD_REQUEST);

    const dashboards = this.config.loadDashboards();
    const dash = dashboards.find((d) => d.id === id);
    if (!dash)
      throw new HttpException("Dashboard олдсонгүй", HttpStatus.NOT_FOUND);
    if (!dash.enabled)
      throw new HttpException("Dashboard идэвхгүй", HttpStatus.BAD_REQUEST);

    const limit = Math.min(Math.max(parseInt(limitStr) || 10, 1), 100);

    let sql: string;
    const params: any[] = [];
    const safeCif = dash.cifColumn;
    const safeAmt = dash.amountColumn;
    const fromExpr = dash.fromClause ?? dash.tableName;

    if (safeAmt) {
      sql = `SELECT * FROM (
        SELECT ${safeCif} AS CIF_VAL, COUNT(*) AS CNT, SUM(NVL(${safeAmt}, 0)) AS TOTAL_AMT
        FROM ${fromExpr}
        WHERE ${safeCif} IS NOT NULL`;
      if (search && search.trim()) {
        const s = search
          .trim()
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 30);
        if (s) {
          sql += ` AND UPPER(${safeCif}) LIKE UPPER(:srch)`;
          params.push(`%${s}%`);
        }
      }
      sql += ` GROUP BY ${safeCif} ORDER BY TOTAL_AMT DESC) WHERE ROWNUM <= :lmt`;
      params.push(limit);
    } else {
      sql = `SELECT * FROM (
        SELECT ${safeCif} AS CIF_VAL, COUNT(*) AS CNT, 0 AS TOTAL_AMT
        FROM ${fromExpr}
        WHERE ${safeCif} IS NOT NULL`;
      if (search && search.trim()) {
        const s = search
          .trim()
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 30);
        if (s) {
          sql += ` AND UPPER(${safeCif}) LIKE UPPER(:srch)`;
          params.push(`%${s}%`);
        }
      }
      sql += ` GROUP BY ${safeCif} ORDER BY CNT DESC) WHERE ROWNUM <= :lmt`;
      params.push(limit);
    }

    let rows: { CIF_VAL: string; CNT: number; TOTAL_AMT: number }[];
    try {
      rows = await this.oracle.query<{
        CIF_VAL: string;
        CNT: number;
        TOTAL_AMT: number;
      }>(sql, params);
    } catch (err: any) {
      // [SEC] AllExceptionsFilter currently masks this behind a generic
      // 422 message, but don't rely on that alone — never construct a
      // payload that embeds the raw SQL/table/schema internals, in case
      // the filter is ever changed or this gets rethrown as user-facing.
      this.logger.warn(
        `Oracle query failed for dashboard ${dash.id} (${dash.tableName}): ${err?.message ?? err}`,
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

  /**
   * GET /api/oracle/search/redflag
   */
  @Get("redflag")
  async getRedFlags() {
    this.requireOracle();

    await this.config.reloadFromClickHouse();

    const dashboards = this.config.getEnabledDashboards();

    const settled = await Promise.allSettled(
      dashboards.map(async (dash) => {
        const fromExpr = dash.fromClause ?? dash.tableName;
        const sql = `SELECT DISTINCT ${dash.cifColumn} AS CIF_VAL FROM ${fromExpr} WHERE ${dash.cifColumn} IS NOT NULL AND ROWNUM <= 50000`;
        const rows = await this.oracle.query<{ CIF_VAL: string }>(sql);
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
        `DB${dash.id} redflag CIF query failed: ${(result.reason as Error).message}`,
      );
      cifSets[dash.id] = new Set();
    });

    const enabledChains = this.config.getEnabledChains();
    const chains = enabledChains.map((chain) => {
      const sourceCifs = new Set<string>();
      for (const id of chain.sourceIds) {
        cifSets[id]?.forEach((c) => sourceCifs.add(c));
      }

      const targetCifs = new Set<string>();
      for (const id of chain.targetIds) {
        cifSets[id]?.forEach((c) => targetCifs.add(c));
      }

      const matches: string[] = [];
      for (const cif of sourceCifs) {
        if (targetCifs.has(cif)) matches.push(cif);
      }
      matches.sort();

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

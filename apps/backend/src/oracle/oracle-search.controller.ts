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
  HttpException,
  HttpStatus,
  Request,
} from "@nestjs/common";
import { OracleConfigService } from "./oracle-config.service";
import { OracleSearchService } from "./oracle-search.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
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

/**
 * Alert Box. Controller нимгэн (§3.1): Oracle SQL, cache, тооцоолол бүгд
 * OracleSearchService-д; тохиргооны CRUD OracleConfigService-д.
 */
@UseGuards(JwtAuthGuard, ToolGuard)
@RequireTools("alert_box")
@Controller("oracle/search")
export class OracleSearchController {
  constructor(
    private readonly search: OracleSearchService,
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

  // ─── Admin config (dashboards + event chains) ───────────────────────────────

  /** GET /oracle/search/admin/dashboards — бүх dashboard-ийн бүрэн тохиргоо (admin) */
  @UseGuards(SuperAdminGuard)
  @Get("admin/dashboards")
  async adminGetDashboards() {
    await this.config.reloadFromClickHouse(true);
    return this.config.loadDashboards();
  }

  /** POST /oracle/search/admin/dashboards — шинэ dashboard (admin) */
  @UseGuards(SuperAdminGuard)
  @Post("admin/dashboards")
  async adminCreateDashboard(
    @Body() body: CreateDashboardDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.config.createDashboard(body);
      await this.logAdminAction(req, "oracle_dashboard_create", "success", {
        name: body.name,
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
  @UseGuards(SuperAdminGuard)
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
  @UseGuards(SuperAdminGuard)
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
  @UseGuards(SuperAdminGuard)
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
      await this.logAdminAction(
        req,
        "oracle_dashboard_set_enabled",
        "success",
        {
          targetId: id,
          enabled: body.enabled,
        },
      );
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
  @UseGuards(SuperAdminGuard)
  @Get("admin/chains")
  async adminGetChains() {
    await this.config.reloadFromClickHouse(true);
    return this.config.loadChains();
  }

  /** POST /oracle/search/admin/chains — шинэ event chain (admin) */
  @UseGuards(SuperAdminGuard)
  @Post("admin/chains")
  async adminCreateChain(
    @Body() body: CreateChainDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.config.createChain(body);
      await this.logAdminAction(req, "oracle_chain_create", "success", {
        name: body.name,
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
  @UseGuards(SuperAdminGuard)
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
  @UseGuards(SuperAdminGuard)
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
  @UseGuards(SuperAdminGuard)
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
  getDashboards() {
    return this.search.listDashboards();
  }

  /** GET /oracle/search/cif?cif=R12345&from=2025-01-01&to=2026-04-09 */
  @Get("cif")
  searchByCif(
    @Query("cif") cif: string,
    @Query("from") dateFrom: string,
    @Query("to") dateTo: string,
  ) {
    return this.search.searchByCif(cif, dateFrom, dateTo);
  }

  /** GET /oracle/search/alerts?min_dashboards=2&limit=200 */
  @Get("alerts")
  getAlerts(
    @Query("min_dashboards") minDash: string,
    @Query("limit") limitStr: string,
    @Query("cif") cifFilter: string,
  ) {
    return this.search.getAlerts(minDash, limitStr, cifFilter);
  }

  /** GET /oracle/search/dashboard-summaries — нийт тоо + нийлбэр дүн */
  @Get("dashboard-summaries")
  getDashboardSummaries() {
    return this.search.getDashboardSummaries();
  }

  /** GET /oracle/search/dashboard/:id/top?limit=10&search= */
  @Get("dashboard/:id/top")
  getDashboardTop(
    @Param("id") idStr: string,
    @Query("limit") limitStr: string,
    @Query("search") search: string,
  ) {
    return this.search.getDashboardTop(idStr, limitStr, search);
  }

  /** GET /oracle/search/redflag */
  @Get("redflag")
  getRedFlags() {
    return this.search.getRedFlags();
  }
}

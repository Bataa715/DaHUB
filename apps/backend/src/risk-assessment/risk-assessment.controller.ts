import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { RiskAssessmentService } from "./risk-assessment.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

interface UpsertScoreBody {
  period: string;
  branchId: string;
  branchName: string;
  indicatorId: string;
  rawValue: number | null;
  score: number;
  note?: string;
  reason?: string;
}

interface CreateIndicatorBody {
  code: string;
  name: string;
  category: string;
  weight: number;
  sourceType: "auto" | "manual" | "hybrid";
  unit: string;
}

@UseGuards(JwtAuthGuard)
@Controller("risk-assessment")
export class RiskAssessmentController {
  constructor(private service: RiskAssessmentService) {}

  // ── Indicators ────────────────────────────────────────────────────────────
  @Get("indicators")
  async listIndicators() {
    return this.service.listIndicators();
  }

  @Post("indicators")
  async createIndicator(@Body() body: CreateIndicatorBody) {
    return this.service.createIndicator(body);
  }

  @Delete("indicators/:id")
  async deleteIndicator(@Param("id") id: string) {
    await this.service.deleteIndicator(id);
    return { ok: true };
  }

  @Patch("indicators/:id")
  async updateIndicator(
    @Param("id") id: string,
    @Body()
    body: { oracleQuery?: string; scoreScale?: number; weight?: number },
  ) {
    await this.service.updateIndicator(id, body);
    return { ok: true };
  }

  // ── Oracle sync ───────────────────────────────────────────────────────────────
  @Post("sync-oracle")
  async syncOracle(@Query("period") period: string, @Request() req) {
    return this.service.syncFromOracle(period, req.user.id);
  }

  // ── Scores ────────────────────────────────────────────────────────────────
  @Get("scores")
  async listScores(@Query("period") period: string) {
    return this.service.listScores(period);
  }

  @Put("scores")
  async upsertScore(@Body() body: UpsertScoreBody, @Request() req) {
    return this.service.upsertScore({ ...body, userId: req.user.id });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  @Get("summary")
  async summary(@Query("period") period: string) {
    return this.service.getSummary(period);
  }

  // ── Audit log per cell ────────────────────────────────────────────────────
  @Get("audit-log")
  async auditLog(
    @Query("period") period: string,
    @Query("branchId") branchId: string,
    @Query("indicatorId") indicatorId: string,
  ) {
    return this.service.getAuditLog(period, branchId, indicatorId);
  }

  // ── BranchRiskass (Oracle stored procedure) ───────────────────────────────
  /**
   * RISKASSESSMENT.BranchRiskass procedure-ийг бүх (эсвэл өгөгдсөн) салбарт
   * дуудаж нэгтгэсэн SUBID 1..35 үнэлгээний мөрүүдийг буцаана.
   *
   * Body: { pDate: 'YYYY-MM-DD', pDateBeg: 'YYYY-MM-DD', branchIds?: number[] }
   */
  @Post("branch-riskass")
  async branchRiskass(
    @Body()
    body: {
      pDate: string;
      pDateBeg: string;
      branchIds?: number[];
    },
    @Request() req,
  ) {
    return this.service.runBranchRiskass({ ...body, userId: req.user.id });
  }

  /**
   * Хэрэглэгчийн сүүлд хадгалсан BranchRiskass үр дүнг ClickHouse-аас унших.
   * Web ачаалах болгонд Oracle-аас дахин татахгүйн тулд ашиглана.
   */
  @Get("branch-riskass/last")
  async branchRiskassLast(@Request() req) {
    return this.service.getLastBranchRiskass(req.user.id);
  }
}

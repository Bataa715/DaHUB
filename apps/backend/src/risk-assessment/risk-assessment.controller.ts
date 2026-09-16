import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { RiskAssessmentService } from "./risk-assessment.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { ToolGuard } from "../auth/guards/tool.guard";
import { RequireTools } from "../auth/guards/require-tools.decorator";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import {
  UpsertManualIndicatorDto,
  SetHoldDto,
  LockDateBodyDto,
  UpsertJudgementDto,
  SaveHistoryFromRiskbranchDto,
  UpsertBranchScoresDto,
} from "./dto/risk-assessment.dto";

// [SEC] "Эрсдэлийн үнэлгээ хийх" (data entry/judgement) and "Тайлан" (read-only
// report + export) used to share one "risk_assessment" permission — anyone
// granted the report couldn't be trusted with edit access without also being
// trusted to touch live judgement data. Split into two tools: read endpoints
// accept EITHER tool (class-level, below); every endpoint that writes/mutates
// data is overridden per-method to require "risk_assessment" specifically, so
// a "risk_assessment_report"-only grant is strictly read + export.
@UseGuards(JwtAuthGuard, ToolGuard)
@RequireTools("risk_assessment", "risk_assessment_report")
@Controller("risk-assessment")
export class RiskAssessmentController {
  constructor(private service: RiskAssessmentService) {}

  // ── Manual indicators ─────────────────────────────────────────────────────
  @Get("manual-indicators")
  async listManualIndicators() {
    return this.service.listManualIndicators();
  }

  @RequireTools("risk_assessment")
  @Put("manual-indicators")
  async upsertManualIndicator(
    @Body() body: UpsertManualIndicatorDto,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.service.upsertManualIndicator({ ...body, userId: req.user.id });
    return { ok: true };
  }

  // ── History ───────────────────────────────────────────────────────────────
  @Get("history")
  async listHistory() {
    return this.service.listHistory();
  }

  @Get("history/:id")
  async getHistory(@Param("id") id: string) {
    return this.service.getHistory(id);
  }

  @UseGuards(AdminGuard)
  @Delete("history/:id")
  async deleteHistory(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    await this.service.deleteHistory(id, req.user.id);
    return { ok: true };
  }

  // ── Indicator holds ───────────────────────────────────────────────────────
  @Get("holds")
  async listHolds(@Query("period") period: string) {
    return this.service.listHolds(period ?? "");
  }

  @RequireTools("risk_assessment")
  @Put("holds")
  async setHold(@Body() body: SetHoldDto, @Request() req: AuthenticatedRequest) {
    await this.service.setHold(
      body.indicatorId,
      body.period,
      body.isHeld,
      req.user.id,
    );
    return { ok: true };
  }

  // ── Riskbranch (Хянах) ─────────────────────────────────────────────────────
  @Get("riskbranch/dates")
  async listRiskbranchDates() {
    return this.service.listRiskbranchDates();
  }

  @Get("riskbranch/lock")
  async getLockedDate() {
    const lockedDate = await this.service.getLockedDate();
    return { lockedDate };
  }

  @RequireTools("risk_assessment")
  @Post("riskbranch/lock")
  async lockDate(@Body() body: LockDateBodyDto, @Request() req: AuthenticatedRequest) {
    await this.service.lockDate(body.date, req.user.id);
    return { ok: true };
  }

  @RequireTools("risk_assessment")
  @Delete("riskbranch/lock/:date")
  async unlockDate(@Param("date") date: string, @Request() req: AuthenticatedRequest) {
    await this.service.unlockDate(date, req.user.id);
    return { ok: true };
  }

  @Get("riskbranch")
  async getRiskbranchLatest(@Query("date") date?: string) {
    if (date) return this.service.getRiskbranchByDate(date);
    return this.service.getRiskbranchLatest();
  }

  // ── Judgement ────────────────────────────────────────────────────────────
  @Get("judgement")
  async listJudgements(@Query("date") date?: string) {
    return this.service.listJudgements(date);
  }

  @RequireTools("risk_assessment")
  @Put("judgement")
  async upsertJudgement(@Body() body: UpsertJudgementDto, @Request() req: AuthenticatedRequest) {
    await this.service.upsertJudgement({ ...body, userId: req.user.id });
    return { ok: true };
  }

  @RequireTools("risk_assessment")
  @Post("history/from-riskbranch")
  async saveHistoryFromRiskbranch(
    @Body() body: SaveHistoryFromRiskbranchDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.saveHistoryFromRiskbranch({
      fetchedDate: body.fetchedDate,
      name: body.name,
      rows: body.rows,
      manualMap: body.manualMap,
      judgementComments: body.judgementComments,
      userId: req.user.id,
      // `username` нь AuthenticatedUser-д зарлагдаагүй (unknown) — string болгож авна
      userName: req.user.name || String(req.user.username ?? ""),
    });
  }

  // ── ETL pre-computed branch scores ────────────────────────────────────────
  @Get("branch-scores")
  async getBranchScores(@Query("date") date?: string) {
    return this.service.getBranchScores(date);
  }

  @UseGuards(AdminGuard)
  @Post("branch-scores")
  async upsertBranchScores(
    @Body() body: UpsertBranchScoresDto,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.service.upsertBranchScores(
      body.fetchDate,
      body.scores,
      req.user.id,
    );
    return { ok: true };
  }
}

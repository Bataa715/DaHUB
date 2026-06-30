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

@UseGuards(JwtAuthGuard, ToolGuard)
@RequireTools("risk_assessment")
@Controller("risk-assessment")
export class RiskAssessmentController {
  constructor(private service: RiskAssessmentService) {}

  // ── Manual indicators ─────────────────────────────────────────────────────
  @Get("manual-indicators")
  async listManualIndicators() {
    return this.service.listManualIndicators();
  }

  @Put("manual-indicators")
  async upsertManualIndicator(
    @Body() body: { branchId: string; indicatorId: string; value: number },
    @Request() req,
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
  async deleteHistory(@Param("id") id: string, @Request() req) {
    await this.service.deleteHistory(id, req.user.id);
    return { ok: true };
  }

  // ── Indicator holds ───────────────────────────────────────────────────────
  @Get("holds")
  async listHolds(@Query("period") period: string) {
    return this.service.listHolds(period ?? "");
  }

  @Put("holds")
  async setHold(
    @Body() body: { indicatorId: string; period: string; isHeld: boolean },
    @Request() req,
  ) {
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

  @Get("riskbranch/latest-all")
  async getRiskbranchLatestAll() {
    return this.service.getRiskbranchLatestAll();
  }

  @Get("riskbranch/lock")
  async getLockedDate() {
    const lockedDate = await this.service.getLockedDate();
    return { lockedDate };
  }

  @Post("riskbranch/lock")
  async lockDate(@Body() body: { date: string }, @Request() req) {
    await this.service.lockDate(body.date, req.user.id);
    return { ok: true };
  }

  @Delete("riskbranch/lock/:date")
  async unlockDate(@Param("date") date: string, @Request() req) {
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

  @Put("judgement")
  async upsertJudgement(
    @Body()
    body: {
      branchId: string;
      branchName: string;
      fetchedDate: string;
      score: number;
      comment?: string;
    },
    @Request() req,
  ) {
    await this.service.upsertJudgement({ ...body, userId: req.user.id });
    return { ok: true };
  }

  @Post("history/from-riskbranch")
  async saveHistoryFromRiskbranch(
    @Body()
    body: {
      fetchedDate: string;
      name: string;
      rows?: unknown[];
      manualMap?: Record<string, Record<string, number>>;
      judgementComments?: Record<string, string>;
    },
    @Request() req,
  ) {
    return this.service.saveHistoryFromRiskbranch({
      fetchedDate: body.fetchedDate,
      name: body.name,
      rows: body.rows,
      manualMap: body.manualMap,
      judgementComments: body.judgementComments,
      userId: req.user.id,
      userName: req.user.name ?? req.user.username ?? "",
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
    @Body()
    body: {
      fetchDate: string;
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
      }[];
    },
    @Request() req,
  ) {
    await this.service.upsertBranchScores(
      body.fetchDate,
      body.scores,
      req.user.id,
    );
    return { ok: true };
  }
}

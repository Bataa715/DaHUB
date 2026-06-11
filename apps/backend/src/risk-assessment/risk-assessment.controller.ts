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

@UseGuards(JwtAuthGuard)
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

  @Delete("history/:id")
  async deleteHistory(@Param("id") id: string) {
    await this.service.deleteHistory(id);
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

  // ── Realtime (Хянах) ─────────────────────────────────────────────────────
  @Get("realtime/dates")
  async listRealtimeDates() {
    return this.service.listRealtimeDates();
  }

  @Get("realtime/lock")
  async getLockedDate() {
    const lockedDate = await this.service.getLockedDate();
    return { lockedDate };
  }

  @Post("realtime/lock")
  async lockDate(@Body() body: { date: string }, @Request() req) {
    await this.service.lockDate(body.date, req.user.id);
    return { ok: true };
  }

  @Delete("realtime/lock/:date")
  async unlockDate(@Param("date") date: string) {
    await this.service.unlockDate(date);
    return { ok: true };
  }

  @Get("realtime/aggregated")
  async getRealtimeAggregated(
    @Query("date") date: string,
    @Query("since") since?: string,
  ) {
    if (!date) return { fetchedDate: '', rows: [], manualMap: {} };
    return this.service.getRealtimeAggregated(date, since || undefined);
  }

  @Get("realtime")
  async getRealtimeLatest(@Query("date") date?: string) {
    if (date) return this.service.getRealtimeByDate(date);
    return this.service.getRealtimeLatest();
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
    },
    @Request() req,
  ) {
    await this.service.upsertJudgement({ ...body, userId: req.user.id });
    return { ok: true };
  }

  @Post("history/from-realtime")
  async saveHistoryFromRealtime(
    @Body() body: { fetchedDate: string; name: string },
    @Request() req,
  ) {
    return this.service.saveHistoryFromRealtime({
      fetchedDate: body.fetchedDate,
      name: body.name,
      userId: req.user.id,
      userName: req.user.name ?? req.user.username ?? "",
    });
  }

  // ── ETL pre-computed branch scores ────────────────────────────────────────
  @Get("branch-scores")
  async getBranchScores(@Query("date") date?: string) {
    return this.service.getBranchScores(date);
  }

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
  ) {
    await this.service.upsertBranchScores(body.fetchDate, body.scores);
    return { ok: true };
  }
}

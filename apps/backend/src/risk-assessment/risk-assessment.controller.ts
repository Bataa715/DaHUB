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

@UseGuards(JwtAuthGuard)
@Controller("risk-assessment")
export class RiskAssessmentController {
  constructor(private service: RiskAssessmentService) {}


  // ── Current data ──────────────────────────────────────────────────────────
  @Get("current")
  async getCurrent() {
    return this.service.getCurrentData();
  }
  @Patch("current/row")
  async overrideCurrentRow(
    @Body() body: { rowKey: string; manualResult: string },
    @Request() req,
  ) {
    await this.service.overrideCurrentRow(
      body.rowKey,
      body.manualResult,
      req.user.id,
    );
    return { ok: true };
  }

  @Post("current/load-realtime")
  async loadRealtimeToCurrent(
    @Body() body: { date: string },
    @Request() req,
  ) {
    return this.service.loadRealtimeToCurrent(body.date, req.user.id);
  }

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
  @Post("history")
  async saveHistory(@Body() body: { name: string }, @Request() req) {
    return this.service.saveHistory({
      name: body.name,
      userId: req.user.id,
      userName: req.user.name ?? req.user.username ?? "",
    });
  }

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

  @Get("realtime")
  async getRealtimeLatest(@Query("date") date?: string) {
    if (date) return this.service.getRealtimeByDate(date);
    return this.service.getRealtimeLatest();
  }

  // ── Work sessions (Хийх) ─────────────────────────────────────────────────
  @Get("work")
  async listWorkSessions() {
    return this.service.listWorkSessions();
  }

  @Post("work/load")
  async loadWorkSession(
    @Body() body: { workDate: string },
    @Request() req,
  ) {
    return this.service.loadWorkSession(body.workDate, req.user.id);
  }

  @Get("work/:date")
  async getWorkSession(@Param("date") date: string) {
    return this.service.getWorkSession(date);
  }

  @Put("work/:date/indicator")
  async upsertWorkSessionIndicator(
    @Param("date") workDate: string,
    @Body() body: { branchId: string; indicatorId: string; value: number },
    @Request() req,
  ) {
    await this.service.upsertWorkSessionIndicator({
      workDate,
      ...body,
      userId: req.user.id,
    });
    return { ok: true };
  }

  @Post("work/:date/finalize")
  async finalizeWorkSession(
    @Param("date") workDate: string,
    @Request() req,
  ) {
    return this.service.finalizeWorkSession(
      workDate,
      req.user.id,
      req.user.name ?? req.user.username ?? "",
    );
  }
}

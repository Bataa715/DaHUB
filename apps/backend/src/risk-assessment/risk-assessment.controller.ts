import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from "@nestjs/common";
import { RiskAssessmentService } from "./risk-assessment.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("risk-assessment")
export class RiskAssessmentController {
  constructor(private service: RiskAssessmentService) {}

  // ── Oracle fetch ──────────────────────────────────────────────────────────
  @Post("branch-riskass")
  async branchRiskass(
    @Body() body: { pDate: string; pDateBeg: string; branchIds?: number[] },
    @Request() req,
  ) {
    return this.service.runBranchRiskass({ ...body, userId: req.user.id });
  }

  // ── Current data ──────────────────────────────────────────────────────────
  @Get("current")
  async getCurrent() {
    return this.service.getCurrentData();
  }

  // ── Override one row RESULT ───────────────────────────────────────────────
  @Patch("branch-riskass/row")
  async overrideRow(
    @Body() body: { rowKey: string; manualResult: string },
    @Request() req,
  ) {
    await this.service.overrideBranchRiskassRow(
      body.rowKey,
      body.manualResult,
      req.user.id,
    );
    return { ok: true };
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
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ToolGuard } from "../auth/guards/tool.guard";
import { RequireTools } from "../auth/guards/require-tools.decorator";
import { AuditLogService } from "../audit/audit-log.service";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { errMessage } from "../common/utils/error-message";
import { NetworkAnalysisService } from "./network-analysis.service";
import {
  ConfigChangeReviewDto,
  ConfigChangesQueryDto,
  XdrQueryDto,
  XdrStatusDto,
} from "./dto/network-analysis.dto";

@UseGuards(JwtAuthGuard, ToolGuard)
// Хоёр дашбоард тус бүр өөрийн эрхтэй — маршрут бүр доор нарийвчилна.
@RequireTools("net_config_changes", "net_xdr")
// ⚠️ Шинэ prefix — prod nginx дээр `location /network-analysis/` нэмэх шаардлагатай.
@Controller("network-analysis")
export class NetworkAnalysisController {
  constructor(
    private readonly networkAnalysis: NetworkAnalysisService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Palo Alto тохиргооны өөрчлөлт ───────────────────────────────────────

  @RequireTools("net_config_changes")
  @Post("config-changes")
  listConfigChanges(@Body() dto: ConfigChangesQueryDto) {
    return this.networkAnalysis.listConfigChanges(dto);
  }

  @RequireTools("net_config_changes")
  @Get("config-changes/:seqno")
  getConfigChange(@Param("seqno") seqno: string) {
    return this.networkAnalysis.getConfigChange(seqno);
  }

  @RequireTools("net_config_changes")
  @Patch("config-changes/:seqno/review")
  async reviewConfigChange(
    @Param("seqno") seqno: string,
    @Body() dto: ConfigChangeReviewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.networkAnalysis.reviewConfigChange(
        seqno,
        dto,
        req.user,
      );
      await this.auditLog.log({
        userId: req.user.id,
        action: "update",
        resource: "net_config_change_review",
        resourceId: seqno,
        method: "PATCH",
        status: "success",
        metadata: { reviewStatus: dto.reviewStatus },
      });
      return result;
    } catch (error: unknown) {
      await this.auditLog.log({
        userId: req.user.id,
        action: "update",
        resource: "net_config_change_review",
        resourceId: seqno,
        method: "PATCH",
        status: "failure",
        errorMessage: errMessage(error),
      });
      throw error;
    }
  }

  // ─── Microsoft Defender XDR ──────────────────────────────────────────────

  @RequireTools("net_xdr")
  @Post("xdr")
  listXdr(@Body() dto: XdrQueryDto) {
    return this.networkAnalysis.listXdr(dto);
  }

  @RequireTools("net_xdr")
  @Patch("xdr/:id/status")
  async updateXdrStatus(
    @Param("id") id: string,
    @Body() dto: XdrStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.networkAnalysis.updateXdrStatus(
        id,
        dto,
        req.user,
      );
      await this.auditLog.log({
        userId: req.user.id,
        action: "update",
        resource: "net_xdr_review",
        resourceId: id,
        method: "PATCH",
        status: "success",
        metadata: { status: dto.status },
      });
      return result;
    } catch (error: unknown) {
      await this.auditLog.log({
        userId: req.user.id,
        action: "update",
        resource: "net_xdr_review",
        resourceId: id,
        method: "PATCH",
        status: "failure",
        errorMessage: errMessage(error),
      });
      throw error;
    }
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { NegativeNewsService } from "./negative-news.service";
import {
  ImportNegativeNewsDto,
  NegativeNewsDashboardDto,
} from "./dto/negative-news.dto";

@UseGuards(JwtAuthGuard, ToolGuard)
// Бүртгэл оруулах (хэрэгсэл) ба үр дүн харах (дашбоард) нь тусдаа эрх.
@RequireTools("negative_news_upload", "negative_news_dashboard")
// ⚠️ Шинэ prefix — prod nginx дээр `location /negative-news/` нэмэх шаардлагатай.
@Controller("negative-news")
export class NegativeNewsController {
  constructor(
    private readonly negativeNews: NegativeNewsService,
    private readonly auditLog: AuditLogService,
  ) {}

  @RequireTools("negative_news_upload")
  @Post("import")
  async importRows(
    @Body() dto: ImportNegativeNewsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.negativeNews.importRows(dto, req.user);
      await this.auditLog.log({
        userId: req.user.id,
        action: "create",
        resource: "negative_news",
        resourceId: result.batchId,
        method: "POST",
        status: "success",
        metadata: {
          fileName: dto.fileName,
          received: result.received,
          inserted: result.inserted,
          duplicates: result.duplicates,
          skipped: result.skipped,
        },
      });
      return result;
    } catch (error: unknown) {
      await this.auditLog.log({
        userId: req.user.id,
        action: "create",
        resource: "negative_news",
        resourceId: dto.batchId ?? "",
        method: "POST",
        status: "failure",
        errorMessage: errMessage(error),
        metadata: { fileName: dto.fileName },
      });
      throw error;
    }
  }

  @RequireTools("negative_news_upload")
  @Get("batches")
  listBatches() {
    return this.negativeNews.listBatches();
  }

  @RequireTools("negative_news_upload")
  @Delete("batches/:batchId")
  async deleteBatch(
    @Param("batchId") batchId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.negativeNews.deleteBatch(batchId);
      await this.auditLog.log({
        userId: req.user.id,
        action: "delete",
        resource: "negative_news_batch",
        resourceId: batchId,
        method: "DELETE",
        status: "success",
        metadata: { deletedRows: result.deletedRows },
      });
      return result;
    } catch (error: unknown) {
      await this.auditLog.log({
        userId: req.user.id,
        action: "delete",
        resource: "negative_news_batch",
        resourceId: batchId,
        method: "DELETE",
        status: "failure",
        errorMessage: errMessage(error),
      });
      throw error;
    }
  }

  @RequireTools("negative_news_dashboard")
  @Post("dashboard")
  dashboard(@Body() dto: NegativeNewsDashboardDto) {
    return this.negativeNews.dashboard(dto);
  }
}

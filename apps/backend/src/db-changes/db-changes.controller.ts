import {
  Body,
  Controller,
  Delete,
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
import { DbChangesService } from "./db-changes.service";
import {
  DbChangesRangeDto,
  DbChangesRecordsDto,
  ImportDbChangesDto,
  ReviewDbChangeDto,
} from "./dto/db-changes.dto";

@UseGuards(JwtAuthGuard, ToolGuard)
// Оруулах + хянах (хэрэгсэл) ба үр дүн харах (дашбоард) нь тусдаа эрх.
@RequireTools("db_changes_upload", "db_changes_dashboard")
// ⚠️ Шинэ prefix — prod nginx дээр `location /db-changes/` нэмэх шаардлагатай.
@Controller("db-changes")
export class DbChangesController {
  constructor(
    private readonly dbChanges: DbChangesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @RequireTools("db_changes_upload")
  @Post("import")
  async importRows(
    @Body() dto: ImportDbChangesDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.dbChanges.importRows(dto, req.user);
      await this.auditLog.log({
        userId: req.user.id,
        action: "create",
        resource: "db_changes",
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
        resource: "db_changes",
        resourceId: dto.batchId ?? "",
        method: "POST",
        status: "failure",
        errorMessage: errMessage(error),
        metadata: { fileName: dto.fileName },
      });
      throw error;
    }
  }

  @RequireTools("db_changes_upload")
  @Get("batches")
  listBatches() {
    return this.dbChanges.listBatches();
  }

  @RequireTools("db_changes_upload")
  @Delete("batches/:batchId")
  async deleteBatch(
    @Param("batchId") batchId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.dbChanges.deleteBatch(batchId);
      await this.auditLog.log({
        userId: req.user.id,
        action: "delete",
        resource: "db_changes_batch",
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
        resource: "db_changes_batch",
        resourceId: batchId,
        method: "DELETE",
        status: "failure",
        errorMessage: errMessage(error),
      });
      throw error;
    }
  }

  @RequireTools("db_changes_upload")
  @Post("records")
  records(@Body() dto: DbChangesRecordsDto) {
    return this.dbChanges.records(dto);
  }

  @RequireTools("db_changes_upload")
  @Patch("records/:rowHash/review")
  async review(
    @Param("rowHash") rowHash: string,
    @Body() dto: ReviewDbChangeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.dbChanges.review(rowHash, dto, req.user);
      await this.auditLog.log({
        userId: req.user.id,
        action: "update",
        resource: "db_change_review",
        resourceId: rowHash,
        method: "PATCH",
        status: "success",
        metadata: { flagged: dto.flagged },
      });
      return result;
    } catch (error: unknown) {
      await this.auditLog.log({
        userId: req.user.id,
        action: "update",
        resource: "db_change_review",
        resourceId: rowHash,
        method: "PATCH",
        status: "failure",
        errorMessage: errMessage(error),
      });
      throw error;
    }
  }

  @RequireTools("db_changes_dashboard")
  @Post("dashboard")
  dashboard(@Body() dto: DbChangesRangeDto) {
    return this.dbChanges.dashboard(dto);
  }
}

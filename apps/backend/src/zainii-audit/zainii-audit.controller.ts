import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ToolGuard } from "../auth/guards/tool.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { RequireTools } from "../auth/guards/require-tools.decorator";
import { ZainiiAuditService } from "./zainii-audit.service";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import {
  RelatedPartyTransactionsDto,
  ExpenseOverviewDto,
  ExpensePaymentRequestsDto,
  ExpenseAttachmentsDto,
  ExpenseBudgetChangesDto,
  ExpenseVerificationDto,
  ExpenseTotalDto,
  CreateVerificationTypeDto,
  UpdateVerificationTypeDto,
  UpdateZainiiAuditSettingsDto,
} from "./dto/zainii-audit.dto";

@UseGuards(JwtAuthGuard, ToolGuard)
// Аль нэг дэд эрх байвал controller-т нэвтэрнэ; маршрут тус бүр доор
// нарийвчилна (`risk_assessment` / `risk_assessment_report`-той ижил загвар).
@RequireTools("zainii_audit_rpt", "zainii_audit_expense")
// [AUDIT] Зам `monitoring` → `zainii-audit`.
//
// `/monitoring` нь дэд бүтцийн ертөнцөд түгээмэл "эзэнтэй" зам (Grafana,
// Prometheus, Zabbix зэрэг ихэвчлэн тэнд суудаг). 2026-07-22-аас 08-13 хүртэл
// prod дээр `/monitoring/*` асуудалгүй ажиллаж байгаад, 09-02 гэхэд 404 өгч
// эхэлсэн — аппын код огт өөрчлөгдөөгүй байхад. Өөрөөр хэлбэл reverse-proxy
// дээр энэ замыг өөр систем булаасан. Аппд өвөрмөц нэр өгснөөр дахин
// мөргөлдөхөөс бүрмөсөн сэргийлнэ.
@Controller("zainii-audit")
export class ZainiiAuditController {
  constructor(private readonly zainiiAudit: ZainiiAuditService) {}

  @RequireTools("zainii_audit_rpt")
  @Post("related-party-transactions")
  findRelatedPartyTransactions(@Body() dto: RelatedPartyTransactionsDto) {
    return this.zainiiAudit.findRelatedPartyTransactions(dto);
  }

  @RequireTools("zainii_audit_expense")
  @Post("expense-overview")
  getExpenseOverview(@Body() dto: ExpenseOverviewDto) {
    return this.zainiiAudit.getExpenseOverview(dto);
  }

  @RequireTools("zainii_audit_expense")
  @Post("expense-payment-requests")
  getExpensePaymentRequests(@Body() dto: ExpensePaymentRequestsDto) {
    return this.zainiiAudit.findPaymentRequestsByCustomer(dto);
  }

  @RequireTools("zainii_audit_expense")
  @Post("expense-attachments")
  getExpenseAttachments(@Body() dto: ExpenseAttachmentsDto) {
    return this.zainiiAudit.findAttachmentsByInvoice(dto);
  }

  @RequireTools("zainii_audit_expense")
  @Post("expense-budget-changes")
  getExpenseBudgetChanges(@Body() dto: ExpenseBudgetChangesDto) {
    return this.zainiiAudit.findBudgetChangesByBookNumber(dto);
  }

  @RequireTools("zainii_audit_expense")
  @Post("expense-verification")
  upsertExpenseVerification(
    @Body() dto: ExpenseVerificationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.zainiiAudit.upsertVerification(dto, {
      userId: req.user.userId,
      name: req.user.name,
    });
  }

  @RequireTools("zainii_audit_expense")
  @Post("expense-total")
  getExpenseTotal(@Body() dto: ExpenseTotalDto) {
    return this.zainiiAudit.getExpenseTotal(dto);
  }

  // ── Verification types (admin-managed reference list) ───────────────────
  @RequireTools("zainii_audit_expense")
  @Get("expense-verification-types")
  listVerificationTypes(@Query("activeOnly") activeOnly?: string) {
    return this.zainiiAudit.listVerificationTypes(activeOnly === "1");
  }

  @UseGuards(SuperAdminGuard)
  @Post("expense-verification-types")
  createVerificationType(@Body() dto: CreateVerificationTypeDto) {
    return this.zainiiAudit.createVerificationType(dto);
  }

  @UseGuards(SuperAdminGuard)
  @Patch("expense-verification-types/:id")
  updateVerificationType(
    @Param("id") id: string,
    @Body() dto: UpdateVerificationTypeDto,
  ) {
    return this.zainiiAudit.updateVerificationType(id, dto);
  }

  @UseGuards(SuperAdminGuard)
  @Delete("expense-verification-types/:id")
  deleteVerificationType(@Param("id") id: string) {
    return this.zainiiAudit.deleteVerificationType(id);
  }

  // ── Анхдагч тохиргоо ────────────────────────────────────────────────────
  // Уншихыг tool-ийн хэрэглэгч бүр хийнэ (дэлгэц нээхэд анхдагч утга авна);
  // өөрчлөхийг зөвхөн супер админ (админ хуудас).

  @Get("settings")
  getSettings() {
    return this.zainiiAudit.getSettings();
  }

  @UseGuards(SuperAdminGuard)
  @Patch("settings")
  updateSettings(
    @Body() dto: UpdateZainiiAuditSettingsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.zainiiAudit.updateSettings(dto, { userId: req.user.userId });
  }
}

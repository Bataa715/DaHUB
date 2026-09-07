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
import { AdminGuard } from "../auth/guards/admin.guard";
import { RequireTools } from "../auth/guards/require-tools.decorator";
import { MonitoringService } from "./monitoring.service";
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
} from "./dto/monitoring.dto";

@UseGuards(JwtAuthGuard, ToolGuard)
// [AUDIT] Эрхийн ID нь `monitoring_box` ХЭВЭЭР — энэ утга users.allowedTools
// баганад хадгалагддаг тул сольвол хэрэглэгч бүрийн эрх чимээгүй алдагдана.
// Зөвхөн HTTP зам болон харагдах нэр өөрчлөгдсөн.
@RequireTools("monitoring_box")
// [AUDIT] Зам `monitoring` → `zainii-audit`.
//
// `/monitoring` нь дэд бүтцийн ертөнцөд түгээмэл "эзэнтэй" зам (Grafana,
// Prometheus, Zabbix зэрэг ихэвчлэн тэнд суудаг). 2026-07-22-аас 08-13 хүртэл
// prod дээр `/monitoring/*` асуудалгүй ажиллаж байгаад, 09-02 гэхэд 404 өгч
// эхэлсэн — аппын код огт өөрчлөгдөөгүй байхад. Өөрөөр хэлбэл reverse-proxy
// дээр энэ замыг өөр систем булаасан. Аппд өвөрмөц нэр өгснөөр дахин
// мөргөлдөхөөс бүрмөсөн сэргийлнэ.
@Controller("zainii-audit")
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Post("related-party-transactions")
  findRelatedPartyTransactions(@Body() dto: RelatedPartyTransactionsDto) {
    return this.monitoring.findRelatedPartyTransactions(dto);
  }

  @Post("expense-overview")
  getExpenseOverview(@Body() dto: ExpenseOverviewDto) {
    return this.monitoring.getExpenseOverview(dto);
  }

  @Post("expense-payment-requests")
  getExpensePaymentRequests(@Body() dto: ExpensePaymentRequestsDto) {
    return this.monitoring.findPaymentRequestsByCustomer(dto);
  }

  @Post("expense-attachments")
  getExpenseAttachments(@Body() dto: ExpenseAttachmentsDto) {
    return this.monitoring.findAttachmentsByInvoice(dto);
  }

  @Post("expense-budget-changes")
  getExpenseBudgetChanges(@Body() dto: ExpenseBudgetChangesDto) {
    return this.monitoring.findBudgetChangesByBookNumber(dto);
  }

  @Post("expense-verification")
  upsertExpenseVerification(
    @Body() dto: ExpenseVerificationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.monitoring.upsertVerification(dto, {
      userId: req.user.userId,
      name: req.user.name,
    });
  }

  @Post("expense-total")
  getExpenseTotal(@Body() dto: ExpenseTotalDto) {
    return this.monitoring.getExpenseTotal(dto);
  }

  // ── Verification types (admin-managed reference list) ───────────────────
  @Get("expense-verification-types")
  listVerificationTypes(@Query("activeOnly") activeOnly?: string) {
    return this.monitoring.listVerificationTypes(activeOnly === "1");
  }

  @UseGuards(AdminGuard)
  @Post("expense-verification-types")
  createVerificationType(@Body() dto: CreateVerificationTypeDto) {
    return this.monitoring.createVerificationType(dto);
  }

  @UseGuards(AdminGuard)
  @Patch("expense-verification-types/:id")
  updateVerificationType(
    @Param("id") id: string,
    @Body() dto: UpdateVerificationTypeDto,
  ) {
    return this.monitoring.updateVerificationType(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete("expense-verification-types/:id")
  deleteVerificationType(@Param("id") id: string) {
    return this.monitoring.deleteVerificationType(id);
  }
}

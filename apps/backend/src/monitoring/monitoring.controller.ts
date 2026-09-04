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
@RequireTools("monitoring_box")
@Controller("monitoring")
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

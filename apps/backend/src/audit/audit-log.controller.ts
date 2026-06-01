import { Controller, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";

@Controller("audit")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AuditLogController {}

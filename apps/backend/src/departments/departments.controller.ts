import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Header,
} from "@nestjs/common";
import { DepartmentsService } from "./departments.service";
import { UpdateDepartmentDto } from "./dto/department.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuditLogService } from "../audit/audit-log.service";
import { AuthenticatedRequest } from "../common/types/authenticated-request";

@Controller("departments")
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(
    private departmentsService: DepartmentsService,
    private auditLogService: AuditLogService,
  ) {}

  // [PERF] rarely changes — short private cache (rides on an auth cookie).
  @Get()
  @Header("Cache-Control", "private, max-age=60")
  findAll() {
    return this.departmentsService.findAll();
  }

  @UseGuards(AdminGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.departmentsService.update(
        id,
        updateDepartmentDto,
      );
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "department_update",
        resource: "departments",
        method: "update",
        status: "success",
        metadata: { targetId: id, ...updateDepartmentDto },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "department_update",
        resource: "departments",
        method: "update",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    try {
      const result = await this.departmentsService.remove(id);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "department_delete",
        resource: "departments",
        method: "delete",
        status: "success",
        metadata: { targetId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "department_delete",
        resource: "departments",
        method: "delete",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }
}

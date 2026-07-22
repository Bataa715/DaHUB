import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { TailanTemplateService } from "./tailan-template.service";
import { UpsertTailanTemplateDto } from "./dto/tailan-template.dto";
import { TailanTemplateScope } from "./tailan-template.types";

@Controller("tailan-templates")
@UseGuards(JwtAuthGuard)
export class TailanTemplateController {
  constructor(private readonly svc: TailanTemplateService) {}

  /** Admin: list all templates (optionally filtered by scope) for the builder UI. */
  @UseGuards(AdminGuard)
  @Get()
  list(@Query("scope") scope?: TailanTemplateScope) {
    return this.svc.list(scope);
  }

  /** Any authenticated user: the active template for their own department. */
  @Get("active")
  getActive(
    @Query("departmentId") departmentId: string | undefined,
    @Query("scope") scope: TailanTemplateScope = "employee",
  ) {
    return this.svc.getActive(departmentId, scope);
  }

  @UseGuards(AdminGuard)
  @Post()
  upsert(
    @Body() dto: UpsertTailanTemplateDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.upsert(dto, user.id);
  }

  @UseGuards(AdminGuard)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.delete(id);
  }
}

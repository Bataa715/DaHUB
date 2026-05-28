import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  RiskIndicatorConfigService,
  IndicatorConfig,
  GroupConfig,
} from "./risk-indicator-config.service";

@Controller("risk-indicator-config")
@UseGuards(JwtAuthGuard, AdminGuard)
export class RiskIndicatorConfigController {
  constructor(private readonly svc: RiskIndicatorConfigService) {}

  @Get()
  list(): Promise<IndicatorConfig[]> {
    return this.svc.listIndicators();
  }

  @Post()
  create(
    @Body()
    dto: Omit<
      IndicatorConfig,
      "seq" | "updated_at" | "is_active" | "updated_by"
    > & {
      hint?: string;
    },
    @CurrentUser() user: { id: string },
  ): Promise<IndicatorConfig> {
    return this.svc.upsertIndicator({ ...dto, id: undefined }, user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: Partial<IndicatorConfig>,
    @CurrentUser() user: { id: string },
  ): Promise<IndicatorConfig> {
    return this.svc.upsertIndicator({ ...dto, id } as any, user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.svc.deleteIndicator(id, user.id);
  }

  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(
    @Body() body: { ids: string[] },
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.svc.reorderIndicators(body.ids, user.id);
  }

  @Get("group-config")
  listGroups(): Promise<GroupConfig[]> {
    return this.svc.listGroupConfig();
  }

  @Post("group-config")
  @HttpCode(HttpStatus.NO_CONTENT)
  upsertGroup(
    @Body()
    dto: { region: string; group_num: number; weight: number; label: string },
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.svc.upsertGroupConfig(dto, user.id);
  }
}

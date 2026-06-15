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
@UseGuards(JwtAuthGuard)
export class RiskIndicatorConfigController {
  constructor(private readonly svc: RiskIndicatorConfigService) {}

  /** GET /risk-indicator-config — бүх нэвтэрсэн хэрэглэгч уншиж болно */
  @Get()
  list(): Promise<IndicatorConfig[]> {
    return this.svc.listIndicators();
  }

  /** GET /risk-indicator-config/group-config — бүх нэвтэрсэн хэрэглэгч уншиж болно */
  @Get("group-config")
  listGroups(): Promise<GroupConfig[]> {
    return this.svc.listGroupConfig();
  }

  @UseGuards(AdminGuard)
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

  @UseGuards(AdminGuard)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: Partial<IndicatorConfig>,
    @CurrentUser() user: { id: string },
  ): Promise<IndicatorConfig> {
    return this.svc.upsertIndicator({ ...dto, id } as any, user.id);
  }

  @UseGuards(AdminGuard)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.svc.deleteIndicator(id, user.id);
  }

  @UseGuards(AdminGuard)
  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(
    @Body() body: { ids: string[] },
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.svc.reorderIndicators(body.ids, user.id);
  }
}

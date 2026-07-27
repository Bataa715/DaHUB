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
import { HomepageEthicsService } from "./homepage-ethics.service";

@Controller("homepage-ethics")
@UseGuards(JwtAuthGuard)
export class HomepageEthicsController {
  constructor(private readonly svc: HomepageEthicsService) {}

  /** Нэвтэрсэн хэрэглэгч — нүүр carousel */
  @Get()
  list() {
    return this.svc.list(true);
  }

  @UseGuards(AdminGuard)
  @Post()
  create(
    @Body() dto: { title: string; body: string; sort_order?: number },
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.create(dto, user.id);
  }

  @UseGuards(AdminGuard)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: Partial<{ title: string; body: string; sort_order: number }>,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.update(id, dto, user.id);
  }

  @UseGuards(AdminGuard)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.svc.remove(id, user.id);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SaveWeeklyReportDto } from "./dto/weekly-report.dto";
import { WeeklyReportService } from "./weekly-report.service";

@UseGuards(JwtAuthGuard)
@Controller("weekly-report")
export class WeeklyReportController {
  constructor(private svc: WeeklyReportService) {}

  @Get("role")
  role(@Request() req: any) {
    return this.svc.getRole(req.user);
  }

  // ── Personal report ──
  @Post("save")
  save(@Body() dto: SaveWeeklyReportDto, @Request() req: any) {
    return this.svc.save(req.user, dto);
  }

  @Get("my/:year/:week")
  getMine(
    @Param("year") year: string,
    @Param("week") week: string,
    @Request() req: any,
  ) {
    return this.svc.getMine(req.user, Number(year), Number(week));
  }

  @Get("consolidated")
  consolidated(
    @Query("year") year: string,
    @Query("week") week: string,
    @Request() req: any,
  ) {
    return this.svc.getConsolidated(req.user, Number(year), Number(week));
  }

  @Post("director-edit/:id")
  directorEdit(
    @Param("id") id: string,
    @Body() body: { sections: Record<string, unknown> },
    @Request() req: any,
  ) {
    return this.svc.directorEdit(req.user, id, body?.sections ?? {});
  }
}

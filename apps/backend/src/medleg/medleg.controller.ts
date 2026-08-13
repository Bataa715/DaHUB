import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Res,
  NotFoundException,
} from "@nestjs/common";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { MedlegService } from "./medleg.service";
import { CreateMedlegDto, UpdateMedlegDto } from "./dto/medleg.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuditLogService } from "../audit/audit-log.service";
import { AuthenticatedRequest } from "../common/types/authenticated-request";

@Controller("medleg")
export class MedlegController {
  constructor(
    private medlegService: MedlegService,
    private auditLogService: AuditLogService,
  ) {}

  // L-7: Authenticated users only — мэдлэг is internal, not public-facing
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Query("page") page = 1, @Query("limit") limit = 100) {
    const take = Math.min(Number(limit), 200);
    const skip = (Number(page) - 1) * take;
    return this.medlegService.findAll(true, take, skip); // always published=true
  }

  // Top publishers leaderboard (by total views) — must be before :id
  @UseGuards(JwtAuthGuard)
  @Get("stats/top-publishers")
  async topPublishers() {
    return this.medlegService.getTopPublishers();
  }

  // ── Admin management (view/edit/delete ANY post, incl. unpublished) ──────
  // Тусдаа "admin/" замд байрлуулснаар доорх ердийн :id route-уудтай зэрэг
  // байх ба эзэмшигчийн шалгалтгүй — зөвхөн AdminGuard-аар хамгаалагдана.
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/all")
  async findAllAdmin(@Query("page") page = 1, @Query("limit") limit = 200) {
    const take = Math.min(Number(limit), 500);
    const skip = (Number(page) - 1) * take;
    return this.medlegService.findAllAdmin(take, skip);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/:id")
  async updateAsAdmin(
    @Param("id") id: string,
    @Body() updateMedlegDto: UpdateMedlegDto,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.medlegService.update(id, updateMedlegDto);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "medleg_admin_update",
        resource: "medleg",
        method: "update",
        status: "success",
        metadata: { targetId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "medleg_admin_update",
        resource: "medleg",
        method: "update",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete("admin/:id")
  async removeAsAdmin(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const result = await this.medlegService.removeAsAdmin(id);
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "medleg_admin_delete",
        resource: "medleg",
        method: "delete",
        status: "success",
        metadata: { targetId: id },
      });
      return result;
    } catch (error: any) {
      await this.auditLogService.log({
        userId: req.user?.id,
        action: "medleg_admin_delete",
        resource: "medleg",
        method: "delete",
        status: "failure",
        errorMessage: error?.message ?? String(error),
        metadata: { targetId: id },
      });
      throw error;
    }
  }

  // Authenticated users only
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findOne(@Param("id") id: string, @Request() req) {
    return this.medlegService.findOne(id, req.user.id);
  }

  // Any authenticated user can create мэдлэг
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  async create(@Body() createMedlegDto: CreateMedlegDto, @Request() req) {
    return this.medlegService.create(createMedlegDto, req.user.id);
  }

  // Нэвтэрсэн ажилтан нийтлэгдсэн мэдлэгийн зургийг харна (дотоод хуваалцах зорилго).
  @UseGuards(JwtAuthGuard)
  @Get(":id/image")
  async getMedlegImage(@Param("id") id: string, @Res() res: Response) {
    const result = await this.medlegService.getMedlegImage(id, 0);
    if (!result) throw new NotFoundException("Зураг олдсонгүй");
    res.set("Content-Type", result.mimeType);
    res.set("Cache-Control", "private, max-age=3600");
    res.send(result.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/images/:index")
  async getMedlegImageAt(
    @Param("id") id: string,
    @Param("index") index: string,
    @Res() res: Response,
  ) {
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0 || idx > 4) {
      throw new NotFoundException("Зураг олдсонгүй");
    }
    const result = await this.medlegService.getMedlegImage(id, idx);
    if (!result) throw new NotFoundException("Зураг олдсонгүй");
    res.set("Content-Type", result.mimeType);
    res.set("Cache-Control", "private, max-age=3600");
    res.send(result.buffer);
  }

  // Authenticated user can delete their own мэдлэг
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @Request() req) {
    return this.medlegService.removeByOwner(id, req.user.id);
  }

  // ── Reactions ────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get(":id/reactions")
  async getReactions(@Param("id") id: string, @Request() req) {
    return this.medlegService.getReactions(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post(":id/react")
  async react(
    @Param("id") id: string,
    @Body() body: { emoji: string },
    @Request() req,
  ) {
    return this.medlegService.react(id, req.user.id, body.emoji);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id/react")
  async removeReaction(@Param("id") id: string, @Request() req) {
    return this.medlegService.removeReaction(id, req.user.id);
  }

  // ── Comments ─────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get(":id/comments")
  async getComments(@Param("id") id: string) {
    return this.medlegService.getComments(id);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(":id/comments")
  async addComment(
    @Param("id") id: string,
    @Body() body: { content: string },
    @Request() req,
  ) {
    return this.medlegService.addComment(
      id,
      req.user.id,
      req.user.name ?? "",
      body.content,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id/comments/:commentId")
  async deleteComment(
    @Param("commentId") commentId: string,
    @Request() req,
  ) {
    return this.medlegService.deleteComment(commentId, req.user.id);
  }
}

import {
  Controller,
  Get,
  Post,
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
import { NewsService } from "./news.service";
import { CreateNewsDto } from "./dto/news.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("news")
export class NewsController {
  constructor(private newsService: NewsService) {}

  // L-7: Authenticated users only — news is internal, not public-facing
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Query("page") page = 1, @Query("limit") limit = 100) {
    const take = Math.min(Number(limit), 200);
    const skip = (Number(page) - 1) * take;
    return this.newsService.findAll(true, take, skip); // always published=true
  }

  // Top publishers leaderboard (by total views) — must be before :id
  @UseGuards(JwtAuthGuard)
  @Get("stats/top-publishers")
  async topPublishers() {
    return this.newsService.getTopPublishers();
  }

  // Authenticated users only
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findOne(@Param("id") id: string, @Request() req) {
    return this.newsService.findOne(id, req.user.id);
  }

  // Any authenticated user can create news
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  async create(@Body() createNewsDto: CreateNewsDto, @Request() req) {
    return this.newsService.create(createNewsDto, req.user.id);
  }

  // [N-6] Authenticated — image tags use same-origin /api proxy so cookie is sent
  @UseGuards(JwtAuthGuard)
  @Get(":id/image")
  async getNewsImage(@Param("id") id: string, @Res() res: Response) {
    const result = await this.newsService.getNewsImage(id);
    if (!result) throw new NotFoundException("Зураг олдсонгүй");
    res.set("Content-Type", result.mimeType);
    res.set("Cache-Control", "private, max-age=3600");
    res.send(result.buffer);
  }

  // Authenticated user can delete their own news
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @Request() req) {
    return this.newsService.removeByOwner(id, req.user.id);
  }

  // ── Reactions ────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get(":id/reactions")
  async getReactions(@Param("id") id: string, @Request() req) {
    return this.newsService.getReactions(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post(":id/react")
  async react(
    @Param("id") id: string,
    @Body() body: { emoji: string },
    @Request() req,
  ) {
    return this.newsService.react(id, req.user.id, body.emoji);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id/react")
  async removeReaction(@Param("id") id: string, @Request() req) {
    return this.newsService.removeReaction(id, req.user.id);
  }

  // ── Comments ─────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get(":id/comments")
  async getComments(@Param("id") id: string) {
    return this.newsService.getComments(id);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(":id/comments")
  async addComment(
    @Param("id") id: string,
    @Body() body: { content: string },
    @Request() req,
  ) {
    return this.newsService.addComment(
      id,
      req.user.id,
      req.user.name ?? "",
      body.content,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id/comments/:commentId")
  async deleteComment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Request() req,
  ) {
    return this.newsService.deleteComment(commentId, req.user.id);
  }
}

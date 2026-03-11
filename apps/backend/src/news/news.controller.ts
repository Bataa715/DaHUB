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
import { NewsService } from "./news.service";
import { CreateNewsDto, UpdateNewsDto } from "./dto/news.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";

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

  // Authenticated users only
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.newsService.findOne(id);
  }

  // Authenticated users only
  @UseGuards(JwtAuthGuard)
  @Get("category/:category")
  async getByCategory(@Param("category") category: string) {
    return this.newsService.getByCategory(category);
  }

  // Admin – all news including drafts
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/all")
  async findAllAdmin(@Query("page") page = 1, @Query("limit") limit = 100) {
    const take = Math.min(Number(limit), 200);
    const skip = (Number(page) - 1) * take;
    return this.newsService.findAll(false, take, skip); // false = include unpublished drafts
  }

  // Admin – create news
  @UseGuards(JwtAuthGuard, AdminGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  async create(@Body() createNewsDto: CreateNewsDto, @Request() req) {
    return this.newsService.create(createNewsDto, req.user.id);
  }

  // Admin – update news
  @UseGuards(JwtAuthGuard, AdminGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch(":id")
  async update(@Param("id") id: string, @Body() updateNewsDto: UpdateNewsDto) {
    return this.newsService.update(id, updateNewsDto);
  }

  // Admin – toggle publish status
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id/toggle-publish")
  async togglePublish(@Param("id") id: string) {
    return this.newsService.togglePublish(id);
  }

  // Public — image tags cannot send auth headers
  @Get(":id/image")
  async getNewsImage(@Param("id") id: string, @Res() res: Response) {
    const result = await this.newsService.getNewsImage(id);
    if (!result) throw new NotFoundException("Зураг олдсонгүй");
    res.set("Content-Type", result.mimeType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(result.buffer);
  }

  // Admin – delete news
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.newsService.remove(id);
  }
}

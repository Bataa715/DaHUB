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
import { Response } from "express";
import { NewsService } from "./news.service";
import { CreateNewsDto, UpdateNewsDto } from "./dto/news.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Public } from "../auth/public.decorator";

@Controller("news")
export class NewsController {
  constructor(private newsService: NewsService) {}

  // Public - Get published news
  @Get()
  async findAll(@Query("published") published?: string) {
    const isPublished = published === "false" ? false : true;
    return this.newsService.findAll(isPublished);
  }

  // Public - Get single news (increments view)
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.newsService.findOne(id);
  }

  // Public - Get news by category
  @Get("category/:category")
  async getByCategory(@Param("category") category: string) {
    return this.newsService.getByCategory(category);
  }

  // Admin - Create news
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createNewsDto: CreateNewsDto, @Request() req) {
    return this.newsService.create(createNewsDto, req.user.id);
  }

  // Admin - Update news
  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(@Param("id") id: string, @Body() updateNewsDto: UpdateNewsDto) {
    return this.newsService.update(id, updateNewsDto);
  }

  // Admin - Toggle publish status
  @UseGuards(JwtAuthGuard)
  @Patch(":id/toggle-publish")
  async togglePublish(@Param("id") id: string) {
    return this.newsService.togglePublish(id);
  }

  // Public - Serve news image binary (no auth so <img src=...> works)
  @Public()
  @Get(":id/image")
  async getNewsImage(@Param("id") id: string, @Res() res: Response) {
    const result = await this.newsService.getNewsImage(id);
    if (!result) throw new NotFoundException("Зураг олдсонгүй");
    res.set("Content-Type", result.mimeType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(result.buffer);
  }

  // Admin - Delete news
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.newsService.remove(id);
  }
}

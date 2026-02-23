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
} from "@nestjs/common";
import { NewsService } from "./news.service";
import { CreateNewsDto, UpdateNewsDto } from "./dto/news.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

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

  // Admin - Delete news
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.newsService.remove(id);
  }
}

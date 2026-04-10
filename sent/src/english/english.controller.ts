import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { EnglishService } from "./english.service";
import {
  CreateWordDto,
  UpdateWordDto,
  RecordReviewDto,
} from "./dto/english.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("english")
@UseGuards(JwtAuthGuard)
export class EnglishController {
  constructor(private readonly service: EnglishService) {}

  @Get("words")
  getWords(@Request() req: any) {
    return this.service.getWords(req.user.id);
  }

  @Get("stats")
  getStats(@Request() req: any) {
    return this.service.getStats(req.user.id);
  }

  @Post("words")
  createWord(@Request() req: any, @Body() dto: CreateWordDto) {
    return this.service.createWord(req.user.id, dto);
  }

  @Put("words/:id")
  updateWord(
    @Param("id") id: string,
    @Request() req: any,
    @Body() dto: UpdateWordDto,
  ) {
    return this.service.updateWord(id, req.user.id, dto);
  }

  @Delete("words/:id")
  deleteWord(@Param("id") id: string, @Request() req: any) {
    return this.service.deleteWord(id, req.user.id);
  }

  @Post("words/:id/review")
  recordReview(
    @Param("id") id: string,
    @Request() req: any,
    @Body() dto: RecordReviewDto,
  ) {
    return this.service.recordReview(id, req.user.id, dto);
  }
}

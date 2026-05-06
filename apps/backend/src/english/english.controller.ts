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
  getWords() {
    return this.service.getWords();
  }

  @Get("stats")
  getStats() {
    return this.service.getStats();
  }

  @Post("words")
  createWord(@Request() req: any, @Body() dto: CreateWordDto) {
    return this.service.createWord(req.user.id, dto);
  }

  @Put("words/:id")
  updateWord(
    @Param("id") id: string,
    @Body() dto: UpdateWordDto,
  ) {
    return this.service.updateWord(id, dto);
  }

  @Delete("words/:id")
  deleteWord(@Param("id") id: string) {
    return this.service.deleteWord(id);
  }

  @Post("words/:id/review")
  recordReview(
    @Param("id") id: string,
    @Body() dto: RecordReviewDto,
  ) {
    return this.service.recordReview(id, dto);
  }
}

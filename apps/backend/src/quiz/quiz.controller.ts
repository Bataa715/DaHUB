import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import { QuizService } from "./quiz.service";
import { CreateQuizDto, AnswerQuizDto } from "./dto/quiz.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";

// [ROUTE ORDER] Энэ controller-ийг QuizModule нь app.module.ts дотор
// MedlegModule-ээс ӨМНӨ import хийсэн байх ёстой — MedlegController-т
// `@Get(":id")`, `@Delete(":id")` гэх мэт нэг-сегменттэй param route байдаг тул
// (жишээ нь /medleg/quiz гэдэг үгийг ":id"=  "quiz" гэж алдаатай барьж болзошгүй).
// Nest/Express route-уудыг REGISTRATION ORDER-оор шалгадаг тул эхэлж
// бүртгэгдсэн literal замууд эрх дээгүүр байна.
@Controller("medleg/quiz")
export class QuizController {
  constructor(private quizService: QuizService) {}

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  async create(
    @Body() dto: CreateQuizDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.quizService.create(dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    return this.quizService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("leaderboard")
  async leaderboard() {
    return this.quizService.leaderboard();
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/results")
  async results(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.quizService.results(id, req.user.id, !!req.user.isAdmin);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(":id/answer")
  async answer(
    @Param("id") id: string,
    @Body() dto: AnswerQuizDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.quizService.answer(id, req.user.id, req.user.name ?? "", dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.quizService.remove(id, req.user.id, !!req.user.isAdmin);
  }
}

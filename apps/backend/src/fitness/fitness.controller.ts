import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { FitnessService } from "./fitness.service";
import {
  CreateExerciseDto,
  CreateWorkoutLogDto,
  CreateBodyStatsDto,
} from "./dto/fitness.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("fitness")
@UseGuards(JwtAuthGuard)
export class FitnessController {
  constructor(private fitnessService: FitnessService) {}

  // Get all data for dashboard
  @Get("dashboard")
  async getDashboardData(@Request() req) {
    return this.fitnessService.getDashboardData(req.user.id);
  }

  // ============ EXERCISES ============

  @Get("exercises")
  async getExercises(@Request() req) {
    return this.fitnessService.getExercises(req.user.id);
  }

  @Post("exercises")
  async createExercise(@Request() req, @Body() dto: CreateExerciseDto) {
    return this.fitnessService.createExercise(req.user.id, dto);
  }

  @Delete("exercises/:id")
  async deleteExercise(@Request() req, @Param("id") id: string) {
    return this.fitnessService.deleteExercise(req.user.id, id);
  }

  // ============ WORKOUT LOGS ============

  @Get("workout-logs")
  async getWorkoutLogs(@Request() req, @Query("limit") limit?: string) {
    return this.fitnessService.getWorkoutLogs(
      req.user.id,
      limit ? parseInt(limit) : 100,
    );
  }

  @Post("workout-logs")
  async createWorkoutLog(@Request() req, @Body() dto: CreateWorkoutLogDto) {
    return this.fitnessService.createWorkoutLog(req.user.id, dto);
  }

  @Delete("workout-logs/:id")
  async deleteWorkoutLog(@Request() req, @Param("id") id: string) {
    return this.fitnessService.deleteWorkoutLog(req.user.id, id);
  }

  // ============ BODY STATS ============

  @Get("body-stats")
  async getBodyStats(@Request() req, @Query("limit") limit?: string) {
    return this.fitnessService.getBodyStats(
      req.user.id,
      limit ? parseInt(limit) : 30,
    );
  }

  @Post("body-stats")
  async createBodyStats(@Request() req, @Body() dto: CreateBodyStatsDto) {
    return this.fitnessService.createBodyStats(req.user.id, dto);
  }

  @Delete("body-stats/:id")
  async deleteBodyStats(@Request() req, @Param("id") id: string) {
    return this.fitnessService.deleteBodyStats(req.user.id, id);
  }
}

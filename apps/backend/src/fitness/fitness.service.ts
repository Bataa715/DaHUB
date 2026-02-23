import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import {
  CreateExerciseDto,
  CreateWorkoutLogDto,
  CreateBodyStatsDto,
} from "./dto/fitness.dto";
import { randomUUID } from "crypto";

@Injectable()
export class FitnessService {
  constructor(private clickhouse: ClickHouseService) {}

  private async checkAccess(userId: string): Promise<boolean> {
    const users = await this.clickhouse.query<any>(
      "SELECT isAdmin, allowedTools FROM users WHERE id = {userId:String} LIMIT 1",
      { userId },
    );

    if (users.length === 0) return false;
    const user = users[0];
    if (user.isAdmin) return true;

    try {
      const allowedTools = user.allowedTools
        ? JSON.parse(user.allowedTools)
        : [];
      return allowedTools.includes("fitness");
    } catch {
      return false;
    }
  }

  // ============ EXERCISES ============

  async getExercises(userId: string) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    return await this.clickhouse.query<any>(
      "SELECT * FROM exercises WHERE userId = {userId:String} ORDER BY createdAt DESC",
      { userId },
    );
  }

  async createExercise(userId: string, dto: CreateExerciseDto) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    const id = randomUUID();
    await this.clickhouse.insert("exercises", [
      {
        id,
        name: dto.name,
        category: dto.category || "",
        description: dto.description || "",
        userId,
        createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      },
    ]);

    const result = await this.clickhouse.query<any>(
      "SELECT * FROM exercises WHERE id = {id:String} LIMIT 1",
      { id },
    );
    return result[0];
  }

  async deleteExercise(userId: string, exerciseId: string) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    const exercises = await this.clickhouse.query<any>(
      "SELECT * FROM exercises WHERE id = {exerciseId:String} AND userId = {userId:String} LIMIT 1",
      { exerciseId, userId },
    );

    if (exercises.length === 0) throw new NotFoundException("Дасгал олдсонгүй");

    await this.clickhouse.exec(
      "ALTER TABLE exercises DELETE WHERE id = {exerciseId:String}",
      { exerciseId },
    );
    return exercises[0];
  }

  // ============ WORKOUT LOGS ============

  async getWorkoutLogs(userId: string, limit = 100) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    const logs = await this.clickhouse.query<any>(
      `SELECT wl.*, e.name as exerciseName, e.category as exerciseCategory
       FROM workout_logs wl
       LEFT JOIN exercises e ON wl.exerciseId = e.id
       WHERE wl.userId = {userId:String}
       ORDER BY wl.date DESC
       LIMIT {limit:UInt32}`,
      { userId, limit },
    );

    return logs.map((log) => ({
      ...log,
      exercise: {
        id: log.exerciseId,
        name: log.exerciseName,
        category: log.exerciseCategory,
      },
    }));
  }

  async createWorkoutLog(userId: string, dto: CreateWorkoutLogDto) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    const exercises = await this.clickhouse.query<any>(
      "SELECT * FROM exercises WHERE id = {exerciseId:String} AND userId = {userId:String} LIMIT 1",
      { exerciseId: dto.exerciseId, userId },
    );

    if (exercises.length === 0) throw new NotFoundException("Дасгал олдсонгүй");
    const exercise = exercises[0];

    const id = randomUUID();
    await this.clickhouse.insert("workout_logs", [
      {
        id,
        exerciseId: dto.exerciseId,
        userId,
        sets: dto.sets || 0,
        repetitions: dto.repetitions || 0,
        weight: dto.weight || 0,
        notes: dto.notes || "",
        date: new Date().toISOString().slice(0, 19).replace("T", " "),
      },
    ]);

    const logs = await this.clickhouse.query<any>(
      "SELECT * FROM workout_logs WHERE id = {id:String} LIMIT 1",
      { id },
    );
    return { ...logs[0], exercise };
  }

  async deleteWorkoutLog(userId: string, logId: string) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    const logs = await this.clickhouse.query<any>(
      "SELECT * FROM workout_logs WHERE id = {logId:String} AND userId = {userId:String} LIMIT 1",
      { logId, userId },
    );

    if (logs.length === 0) throw new NotFoundException("Бүртгэл олдсонгүй");

    await this.clickhouse.exec(
      `ALTER TABLE workout_logs DELETE WHERE id = '${logId}'`,
    );
    return logs[0];
  }

  // ============ BODY STATS ============

  async getBodyStats(userId: string, limit = 30) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    return await this.clickhouse.query<any>(
      "SELECT * FROM body_stats WHERE userId = {userId:String} ORDER BY date DESC LIMIT {limit:UInt32}",
      { userId, limit },
    );
  }

  async createBodyStats(userId: string, dto: CreateBodyStatsDto) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    const id = randomUUID();
    await this.clickhouse.insert("body_stats", [
      {
        id,
        userId,
        weight: dto.weight,
        height: dto.height,
        date: new Date().toISOString().slice(0, 19).replace("T", " "),
      },
    ]);

    const result = await this.clickhouse.query<any>(
      "SELECT * FROM body_stats WHERE id = {id:String} LIMIT 1",
      { id },
    );
    return result[0];
  }

  async deleteBodyStats(userId: string, statsId: string) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    const stats = await this.clickhouse.query<any>(
      "SELECT * FROM body_stats WHERE id = {statsId:String} AND userId = {userId:String} LIMIT 1",
      { statsId, userId },
    );

    if (stats.length === 0) throw new NotFoundException("Бүртгэл олдсонгүй");

    await this.clickhouse.exec(
      `ALTER TABLE body_stats DELETE WHERE id = '${statsId}'`,
    );
    return stats[0];
  }

  // ============ DASHBOARD DATA ============

  async getDashboardData(userId: string) {
    if (!(await this.checkAccess(userId)))
      throw new ForbiddenException("Эрх хүрэхгүй байна");

    const exercises = await this.clickhouse.query<any>(
      "SELECT * FROM exercises WHERE userId = {userId:String} ORDER BY createdAt DESC",
      { userId },
    );

    const workoutLogsRaw = await this.clickhouse.query<any>(
      `SELECT wl.*, e.name as exerciseName, e.category as exerciseCategory
       FROM workout_logs wl
       LEFT JOIN exercises e ON wl.exerciseId = e.id
       WHERE wl.userId = {userId:String}
       ORDER BY wl.date DESC
       LIMIT 100`,
      { userId },
    );

    const workoutLogs = workoutLogsRaw.map((log) => ({
      ...log,
      exercise: {
        id: log.exerciseId,
        name: log.exerciseName,
        category: log.exerciseCategory,
      },
    }));

    const bodyStats = await this.clickhouse.query<any>(
      "SELECT * FROM body_stats WHERE userId = {userId:String} ORDER BY date DESC LIMIT 30",
      { userId },
    );

    return { exercises, workoutLogs, bodyStats };
  }
}

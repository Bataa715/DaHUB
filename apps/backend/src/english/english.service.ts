import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { CreateWordDto, UpdateWordDto, RecordReviewDto } from "./dto/english.dto";

const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

@Injectable()
export class EnglishService {
  private readonly logger = new Logger(EnglishService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private mapWord(r: any) {
    return {
      id: r.id,
      word: r.word,
      translation: r.translation,
      definition: r.definition ?? "",
      example: r.example ?? "",
      partOfSpeech: r.partOfSpeech ?? "",
      difficulty: Number(r.difficulty ?? 1),
      totalReviews: Number(r.totalReviews ?? 0),
      correctReviews: Number(r.correctReviews ?? 0),
      lastReviewedAt:
        r.lastReviewedAt === "1970-01-01 00:00:00" ? null : r.lastReviewedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async getWords(userId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM english_words FINAL
       WHERE userId = {userId:String}
       ORDER BY createdAt DESC`,
      { userId },
    );
    return rows.map((r) => this.mapWord(r));
  }

  async createWord(userId: string, dto: CreateWordDto) {
    const now = fmt(new Date());
    const id = randomUUID();

    await this.clickhouse.insert("english_words", [
      {
        id,
        word: dto.word.trim(),
        translation: dto.translation.trim(),
        definition: dto.definition?.trim() ?? "",
        example: dto.example?.trim() ?? "",
        partOfSpeech: dto.partOfSpeech?.trim() ?? "",
        difficulty: dto.difficulty ?? 1,
        userId,
        totalReviews: 0,
        correctReviews: 0,
        lastReviewedAt: "1970-01-01 00:00:00",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    this.logger.log(`Word "${dto.word}" created by user ${userId}`);
    return { id };
  }

  async updateWord(id: string, userId: string, dto: UpdateWordDto) {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM english_words FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    const existing = rows[0];
    if (!existing) throw new NotFoundException("Үг олдсонгүй");
    if (existing.userId !== userId)
      throw new ForbiddenException("Зөвхөн өөрийн үгийг засах боломжтой");

    const now = fmt(new Date());

    await this.clickhouse.insert("english_words", [
      {
        ...existing,
        word: (dto.word ?? existing.word).trim(),
        translation: (dto.translation ?? existing.translation).trim(),
        definition: (dto.definition ?? existing.definition ?? "").trim(),
        example: (dto.example ?? existing.example ?? "").trim(),
        partOfSpeech: (dto.partOfSpeech ?? existing.partOfSpeech ?? "").trim(),
        difficulty: dto.difficulty ?? existing.difficulty ?? 1,
        updatedAt: now,
      },
    ]);

    return { success: true };
  }

  async deleteWord(id: string, userId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM english_words FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    const existing = rows[0];
    if (!existing) throw new NotFoundException("Үг олдсонгүй");
    if (existing.userId !== userId)
      throw new ForbiddenException("Зөвхөн өөрийн үгийг устгах боломжтой");

    // Hard-delete via ALTER TABLE DELETE (parameterized)
    await this.clickhouse.exec(
      `ALTER TABLE english_words DELETE WHERE id = {id:String}`,
      { id },
    );

    this.logger.log(`Word ${id} deleted by user ${userId}`);
    return { success: true };
  }

  // ─── Review ───────────────────────────────────────────────────────────────

  async recordReview(id: string, userId: string, dto: RecordReviewDto) {
    const rows = await this.clickhouse.query<any>(
      `SELECT * FROM english_words FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    const existing = rows[0];
    if (!existing) throw new NotFoundException("Үг олдсонгүй");
    if (existing.userId !== userId)
      throw new ForbiddenException("Зөвхөн өөрийн үгийг шалгах боломжтой");

    const now = fmt(new Date());

    await this.clickhouse.insert("english_words", [
      {
        ...existing,
        totalReviews: Number(existing.totalReviews ?? 0) + 1,
        correctReviews:
          Number(existing.correctReviews ?? 0) + (dto.correct ? 1 : 0),
        lastReviewedAt: now,
        updatedAt: now,
      },
    ]);

    return { success: true };
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(userId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT
         count() AS total,
         countIf(totalReviews > 0) AS reviewed,
         countIf(totalReviews > 0 AND correctReviews / totalReviews >= 0.8) AS mastered,
         sum(totalReviews) AS totalReviews,
         sum(correctReviews) AS totalCorrect
       FROM english_words FINAL
       WHERE userId = {userId:String}`,
      { userId },
    );
    const r = rows[0] ?? {};
    return {
      total: Number(r.total ?? 0),
      reviewed: Number(r.reviewed ?? 0),
      mastered: Number(r.mastered ?? 0),
      totalReviews: Number(r.totalReviews ?? 0),
      totalCorrect: Number(r.totalCorrect ?? 0),
    };
  }
}

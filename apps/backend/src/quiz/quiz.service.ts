import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { randomUUID } from "crypto";
import { CreateQuizDto, AnswerQuizDto } from "./dto/quiz.dto";

// Нэг quiz дотор зөвшөөрөгдөх асуултын дээд тоо — DTO-той тааруулав.
const MAX_QUESTIONS_PER_QUIZ = 20;

// [PERF] leaderboard() recomputes a full aggregation every call; cache briefly.
const LEADERBOARD_CACHE_TTL_MS = 15_000;

@Injectable()
export class QuizService {
  private leaderboardCache: { data: unknown; loadedAt: number } | null = null;

  constructor(private clickhouse: ClickHouseService) {}

  // [MULTI-Q] Нэг quiz-д 1-20 асуулт байж болно. Асуулт бүрийг тусдаа
  // medleg_quiz_questions мөр болгон, seq (дараалал) -тай хамт хадгална.
  async create(dto: CreateQuizDto, authorId: string) {
    if (dto.questions.length === 0 || dto.questions.length > MAX_QUESTIONS_PER_QUIZ) {
      throw new BadRequestException(
        `Асуултын тоо 1-ээс ${MAX_QUESTIONS_PER_QUIZ} хооронд байх ёстой`,
      );
    }

    const cleanQuestions = dto.questions.map((q, i) => {
      const cleanOptions = q.options.map((o) => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2) {
        throw new BadRequestException(
          `${i + 1}-р асуултад хамгийн багадаа 2 сонголт оруулна уу`,
        );
      }
      if (q.correctIndex < 0 || q.correctIndex >= cleanOptions.length) {
        throw new BadRequestException(
          `${i + 1}-р асуултын зөв хариултын индекс сонголтын тооноос хэтэрсэн байна`,
        );
      }
      const question = q.question.trim();
      if (!question) {
        throw new BadRequestException(`${i + 1}-р асуултын текст хоосон байна`);
      }
      return { question, options: cleanOptions, correctIndex: q.correctIndex };
    });

    const id = randomUUID();
    const now = nowCH();
    await this.clickhouse.insert("medleg_quizzes", [
      {
        id,
        title: dto.title.trim(),
        authorId,
        isActive: 1,
        createdAt: now,
      },
    ]);

    await this.clickhouse.insert(
      "medleg_quiz_questions",
      cleanQuestions.map((q, seq) => ({
        id: randomUUID(),
        quizId: id,
        seq,
        question: q.question,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        createdAt: now,
      })),
    );

    return { id, message: "Quiz амжилттай үүслээ" };
  }

  /**
   * Идэвхтэй бүх quiz-ийг асуултуудын хамт жагсаана. Асуулт бүрийн зөв
   * хариултыг зөвхөн (a) тухайн quiz-ийг бүрэн хариулсан, эсвэл (b) зохиогч
   * хэрэглэгчид харуулна — бусад хэрэглэгчид хариулахаасаа өмнө хуурч
   * болохгүй.
   */
  async findAll(userId: string) {
    const quizzes = await this.clickhouse.query<any>(
      `SELECT q.id, q.title, q.authorId, q.createdAt, q.isActive,
              u.name as authorName
       FROM medleg_quizzes q
       LEFT JOIN users u ON q.authorId = u.id
       WHERE q.isActive = 1
       ORDER BY q.createdAt DESC
       LIMIT 200`,
    );
    if (quizzes.length === 0) return [];

    const ids = quizzes.map((q: any) => q.id);

    const questions = await this.clickhouse.query<any>(
      `SELECT id, quizId, seq, question, options, correctIndex
       FROM medleg_quiz_questions
       WHERE quizId IN {ids:Array(String)}
       ORDER BY quizId, seq`,
      { ids },
    );
    const questionsByQuiz = new Map<string, any[]>();
    for (const q of questions) {
      if (!questionsByQuiz.has(q.quizId)) questionsByQuiz.set(q.quizId, []);
      questionsByQuiz.get(q.quizId)!.push(q);
    }

    const attempts = await this.clickhouse.query<any>(
      `SELECT quizId, userId, correctCount, totalQuestions, timeTakenMs
       FROM medleg_quiz_answers
       WHERE quizId IN {ids:Array(String)}`,
      { ids },
    );
    const attemptCountByQuiz = new Map<string, number>();
    const scoreSumByQuiz = new Map<string, number>();
    const myAttemptByQuiz = new Map<string, any>();
    for (const a of attempts) {
      attemptCountByQuiz.set(a.quizId, (attemptCountByQuiz.get(a.quizId) ?? 0) + 1);
      const total = Number(a.totalQuestions) || 0;
      const pct = total > 0 ? (Number(a.correctCount) / total) * 100 : 0;
      scoreSumByQuiz.set(a.quizId, (scoreSumByQuiz.get(a.quizId) ?? 0) + pct);
      if (a.userId === userId) myAttemptByQuiz.set(a.quizId, a);
    }

    return quizzes.map((q: any) => {
      const mine = myAttemptByQuiz.get(q.id);
      const isAuthor = q.authorId === userId;
      const revealed = !!mine || isAuthor;
      const qs = (questionsByQuiz.get(q.id) ?? []).map((qq) => ({
        id: qq.id,
        question: qq.question,
        options: JSON.parse(qq.options || "[]"),
        correctIndex: revealed ? Number(qq.correctIndex) : null,
      }));
      const answerCount = attemptCountByQuiz.get(q.id) ?? 0;
      const scoreSum = scoreSumByQuiz.get(q.id) ?? 0;
      return {
        id: q.id,
        title: q.title,
        authorId: q.authorId,
        authorName: q.authorName || "Unknown",
        createdAt: q.createdAt,
        questions: qs,
        questionCount: qs.length,
        answerCount,
        avgScorePercent: answerCount > 0 ? Math.round(scoreSum / answerCount) : null,
        myAttempt: mine
          ? {
              correctCount: Number(mine.correctCount),
              totalQuestions: Number(mine.totalQuestions),
              timeTakenMs: Number(mine.timeTakenMs),
            }
          : null,
      };
    });
  }

  /**
   * Quiz-ийн бүх асуултад НЭГ дор хариулна (нэг оролдлого). Хэрэглэгч
   * quiz бүрд зөвхөн нэг удаа оролдлого хийж болно.
   */
  async answer(
    quizId: string,
    userId: string,
    userName: string,
    dto: AnswerQuizDto,
  ) {
    const quizzes = await this.clickhouse.query<any>(
      `SELECT * FROM medleg_quizzes WHERE id = {id:String} LIMIT 1`,
      { id: quizId },
    );
    if (quizzes.length === 0) throw new NotFoundException("Quiz олдсонгүй");
    const quiz = quizzes[0];
    if (!Number(quiz.isActive)) {
      throw new BadRequestException("Энэ quiz хаагдсан байна");
    }

    const questions = await this.clickhouse.query<any>(
      `SELECT id, correctIndex, options FROM medleg_quiz_questions
       WHERE quizId = {quizId:String}`,
      { quizId },
    );
    if (questions.length === 0) throw new NotFoundException("Асуулт олдсонгүй");

    const existing = await this.clickhouse.query<any>(
      `SELECT id FROM medleg_quiz_answers
       WHERE quizId = {quizId:String} AND userId = {userId:String} LIMIT 1`,
      { quizId, userId },
    );
    if (existing.length > 0) {
      throw new BadRequestException("Та энэ quiz-д аль хэдийн хариулсан байна");
    }

    // Бүх асуултад яг нэг удаа хариулсан эсэхийг шалгана (дутуу/давхардсан байж болохгүй).
    const questionById = new Map(questions.map((q: any) => [q.id, q]));
    const answeredIds = new Set(dto.answers.map((a) => a.questionId));
    if (
      answeredIds.size !== questions.length ||
      dto.answers.length !== questions.length
    ) {
      throw new BadRequestException(
        "Quiz-ийн бүх асуултад яг нэг удаа хариулна уу",
      );
    }

    let correctCount = 0;
    const answersDetail: { questionId: string; selectedIndex: number; isCorrect: boolean }[] = [];
    for (const a of dto.answers) {
      const q = questionById.get(a.questionId);
      if (!q) {
        throw new BadRequestException("Буруу асуултын дугаар илэрлээ");
      }
      const options = JSON.parse(q.options || "[]");
      if (a.selectedIndex < 0 || a.selectedIndex >= options.length) {
        throw new BadRequestException("Буруу сонголт");
      }
      const isCorrect = Number(a.selectedIndex) === Number(q.correctIndex);
      if (isCorrect) correctCount++;
      answersDetail.push({
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        isCorrect,
      });
    }

    // [SEC] timeTakenMs — клиентээс ирсэн утга, 1 цагаас (3,600,000мс) хэтрэхгүй
    // байхаар хязгаарлана (сэдэвчилсэн L&D агуулга тул өндөр эрсдэлгүй ч
    // санамсаргүй/буруу утгаас хамгаална).
    const timeTakenMs = Math.min(Math.max(0, Number(dto.timeTakenMs) || 0), 3_600_000);

    await this.clickhouse.insert("medleg_quiz_answers", [
      {
        id: randomUUID(),
        quizId,
        userId,
        userName,
        correctCount,
        totalQuestions: questions.length,
        timeTakenMs,
        answersJson: JSON.stringify(answersDetail),
        answeredAt: nowCH(),
      },
    ]);

    this.leaderboardCache = null; // invalidate so this attempt shows up immediately

    return {
      correctCount,
      totalQuestions: questions.length,
      results: answersDetail,
    };
  }

  /**
   * Тухайн quiz-ийн бүх хэрэглэгчийн оролдлогын жагсаалт — хамгийн олон
   * зөв хариулсан + хамгийн хурдан нь эхэнд. [SEC] Зөвхөн (a) аль хэдийн
   * хариулсан, (b) зохиогч, эсвэл (c) админ хэрэглэгчид харагдана.
   */
  async results(quizId: string, requesterId: string, isAdmin: boolean) {
    const quizzes = await this.clickhouse.query<any>(
      `SELECT id, authorId FROM medleg_quizzes WHERE id = {id:String} LIMIT 1`,
      { id: quizId },
    );
    if (quizzes.length === 0) throw new NotFoundException("Quiz олдсонгүй");

    if (quizzes[0].authorId !== requesterId && !isAdmin) {
      const mine = await this.clickhouse.query<any>(
        `SELECT id FROM medleg_quiz_answers
         WHERE quizId = {quizId:String} AND userId = {userId:String} LIMIT 1`,
        { quizId, userId: requesterId },
      );
      if (mine.length === 0) {
        throw new ForbiddenException(
          "Эхлээд quiz-д хариулсны дараа үр дүнг харах боломжтой",
        );
      }
    }

    const rows = await this.clickhouse.query<any>(
      `SELECT userId, userName, correctCount, totalQuestions, timeTakenMs, answeredAt
       FROM medleg_quiz_answers
       WHERE quizId = {quizId:String}
       ORDER BY correctCount DESC, timeTakenMs ASC`,
      { quizId },
    );

    return rows.map((r: any, i: number) => ({
      rank: i + 1,
      userId: r.userId,
      userName: r.userName,
      correctCount: Number(r.correctCount),
      totalQuestions: Number(r.totalQuestions),
      timeTakenMs: Number(r.timeTakenMs),
      answeredAt: r.answeredAt,
    }));
  }

  /**
   * Нийт leaderboard — бүх quiz дээрх хамгийн олон зөв хариулсан, тэнцвэл
   * хамгийн хурдан (дундаж хугацаа) хариулсан хэрэглэгчээр эрэмбэлнэ.
   */
  async leaderboard() {
    if (
      this.leaderboardCache &&
      Date.now() - this.leaderboardCache.loadedAt < LEADERBOARD_CACHE_TTL_MS
    ) {
      return this.leaderboardCache.data;
    }

    const rows = await this.clickhouse.query<any>(
      `SELECT userId, userName,
              count() AS totalAttempts,
              sum(correctCount) AS totalCorrect,
              sum(totalQuestions) AS totalQuestions,
              avg(timeTakenMs) AS avgTimeMs
       FROM medleg_quiz_answers
       GROUP BY userId, userName
       ORDER BY totalCorrect DESC, avgTimeMs ASC
       LIMIT 50`,
    );
    const result = rows.map((r: any, i: number) => ({
      rank: i + 1,
      userId: r.userId,
      userName: r.userName,
      totalAttempts: Number(r.totalAttempts),
      correctCount: Number(r.totalCorrect),
      totalQuestions: Number(r.totalQuestions),
      avgTimeMs: r.avgTimeMs != null ? Number(r.avgTimeMs) : null,
    }));
    this.leaderboardCache = { data: result, loadedAt: Date.now() };
    return result;
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    const quizzes = await this.clickhouse.query<any>(
      `SELECT id, authorId FROM medleg_quizzes WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (quizzes.length === 0) throw new NotFoundException("Quiz олдсонгүй");
    if (quizzes[0].authorId !== userId && !isAdmin) {
      throw new ForbiddenException("Зөвхөн өөрийн quiz-ийг устгах боломжтой");
    }
    await this.clickhouse.exec(
      `ALTER TABLE medleg_quizzes DELETE WHERE id = {id:String}`,
      { id },
    );
    await this.clickhouse.exec(
      `ALTER TABLE medleg_quiz_questions DELETE WHERE quizId = {id:String}`,
      { id },
    );
    await this.clickhouse.exec(
      `ALTER TABLE medleg_quiz_answers DELETE WHERE quizId = {id:String}`,
      { id },
    );
    this.leaderboardCache = null;
    return { message: "Quiz устгагдлаа" };
  }
}

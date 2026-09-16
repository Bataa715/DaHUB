import { createHash, randomUUID } from "crypto";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import {
  ImportNegativeNewsDto,
  NegativeNewsAiDto,
  NegativeNewsDashboardDto,
} from "./dto/negative-news.dto";
import {
  GOLOMT_BANK,
  buildAiMessage,
  buildAiPrompt,
  isValidIsoDate,
  newsRowKey,
  normalizeNewsRow,
  parseAiLines,
} from "./negative-news.logic";
import { NegativeNewsAiService } from "./negative-news-ai.service";

const MAX_SCAN_ROWS = 20_000;
const MAX_LIST_ROWS = 500;
const MAX_RANGE_DAYS = 366;

type User = { userId: string; name: string };

export interface NewsRow {
  rowHash: string;
  newsDate: string;
  channel: string;
  bank: string;
  category: string;
  content: string;
}

export interface BatchRow {
  batchId: string;
  fileName: string;
  sheetName: string;
  rowCount: number | string;
  newRows: number | string;
  duplicateRows: number | string;
  skippedRows: number | string;
  minDate: string;
  maxDate: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

const hashRow = (key: string) => createHash("sha256").update(key).digest("hex");

const countDesc = (values: string[]) =>
  [
    ...values.reduce(
      (m, v) => m.set(v || "—", (m.get(v || "—") ?? 0) + 1),
      new Map<string, number>(),
    ),
  ]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

/**
 * Сөрөг мэдээ — Excel-ээр бүртгэл оруулах (Хэрэгсэл) ба шинжилгээ (Дашбоард).
 *
 * Өмнө нь файл серверт хадгалагдаж, скрипт 7 хоног тутам имэйл илгээдэг байв.
 * Одоо мөр бүр ClickHouse-д хадгалагдана; дашбоард хүссэн хугацаагаар шууд тооцно.
 * Нэг мэдээг дахин оруулахад давхардахгүй (агуулгын hash-аар таньна).
 */
@Injectable()
export class NegativeNewsService implements OnModuleInit {
  private readonly logger = new Logger(NegativeNewsService.name);

  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly ai: NegativeNewsAiService,
  ) {}

  async onModuleInit() {
    const ddl = [
      `CREATE TABLE IF NOT EXISTS negative_news (
        rowHash        String,
        newsDate       Date,
        channel        LowCardinality(String),
        bank           LowCardinality(String),
        category       String,
        content        String,
        batchId        String,
        uploadedBy     String,
        uploadedByName String,
        uploadedAt     DateTime
      ) ENGINE = ReplacingMergeTree(uploadedAt)
        ORDER BY rowHash`,
      `CREATE TABLE IF NOT EXISTS negative_news_batches (
        batchId        String,
        fileName       String,
        sheetName      String,
        rowCount       UInt32,
        newRows        UInt32,
        duplicateRows  UInt32,
        skippedRows    UInt32,
        minDate        Date,
        maxDate        Date,
        uploadedBy     String,
        uploadedByName String,
        createdAt      DateTime,
        updatedAt      DateTime
      ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY batchId`,
    ];
    for (const sql of ddl) {
      try {
        await this.clickhouse.exec(sql);
      } catch (e) {
        this.logger.error(
          `Сөрөг мэдээний хүснэгт үүсгэхэд алдаа: ${String(e)}`,
        );
      }
    }
  }

  // ─── Бүртгэл оруулах ─────────────────────────────────────────────────────

  private async getBatch(batchId: string): Promise<BatchRow | undefined> {
    const rows = await this.clickhouse.query<BatchRow>(
      `SELECT batchId, fileName, sheetName, rowCount, newRows, duplicateRows, skippedRows,
              minDate, maxDate,
              uploadedBy, uploadedByName,
              createdAt
       FROM negative_news_batches FINAL
       WHERE batchId = {batchId:String}
       LIMIT 1`,
      { batchId },
    );
    return rows[0];
  }

  async importRows(dto: ImportNegativeNewsDto, user: User) {
    const existingBatch = dto.batchId
      ? await this.getBatch(dto.batchId)
      : undefined;
    if (dto.batchId && !existingBatch)
      throw new NotFoundException("Багц олдсонгүй");
    const batchId = dto.batchId ?? randomUUID();
    const now = nowCH();

    // Нормчилж, буруу мөрийг алгасаад, хэсэг доторх давхардлыг арилгана
    let skipped = 0;
    const unique = new Map<string, ReturnType<typeof normalizeNewsRow>>();
    for (const raw of dto.rows) {
      const row = normalizeNewsRow(raw);
      if (!isValidIsoDate(row.newsDate) || !row.content || !row.bank) {
        skipped++;
        continue;
      }
      unique.set(hashRow(newsRowKey(row)), row);
    }

    const hashes = [...unique.keys()];
    const existing = hashes.length
      ? await this.clickhouse.query<{ rowHash: string }>(
          `SELECT DISTINCT rowHash FROM negative_news WHERE rowHash IN {hashes:Array(String)}`,
          { hashes },
        )
      : [];
    const existingSet = new Set(existing.map((r) => r.rowHash));

    const fresh = hashes
      .filter((h) => !existingSet.has(h))
      .map((h) => ({
        rowHash: h,
        ...unique.get(h)!,
        batchId,
        uploadedBy: user.userId,
        uploadedByName: user.name,
        uploadedAt: now,
      }));

    if (fresh.length) await this.clickhouse.insert("negative_news", fresh);

    // Багцын нэгтгэл — хэсэг бүрээр хуримтлуулна (ReplacingMergeTree: бүтэн мөр)
    const dates = [...unique.values()].map((r) => r.newsDate).sort();
    const prevMin =
      existingBatch && Number(existingBatch.rowCount) > 0
        ? existingBatch.minDate
        : null;
    const prevMax =
      existingBatch && Number(existingBatch.rowCount) > 0
        ? existingBatch.maxDate
        : null;
    const minDate =
      [prevMin, dates[0]].filter(Boolean).sort()[0] ?? "1970-01-01";
    const maxDate =
      [prevMax, dates[dates.length - 1]].filter(Boolean).sort().pop() ??
      "1970-01-01";

    const batch = {
      batchId,
      fileName: dto.fileName,
      sheetName: dto.sheetName ?? "",
      rowCount: Number(existingBatch?.rowCount ?? 0) + dto.rows.length,
      newRows: Number(existingBatch?.newRows ?? 0) + fresh.length,
      // Хэсэг доторх давхардал + өмнө нь оруулсан мөр
      duplicateRows:
        Number(existingBatch?.duplicateRows ?? 0) +
        (dto.rows.length - skipped - fresh.length),
      skippedRows: Number(existingBatch?.skippedRows ?? 0) + skipped,
      minDate,
      maxDate,
      uploadedBy: existingBatch?.uploadedBy ?? user.userId,
      uploadedByName: existingBatch?.uploadedByName ?? user.name,
      createdAt: existingBatch?.createdAt ?? now,
      updatedAt: now,
    };
    await this.clickhouse.insert("negative_news_batches", [batch]);

    return {
      batchId,
      received: dto.rows.length,
      inserted: fresh.length,
      duplicates: dto.rows.length - skipped - fresh.length,
      skipped,
    };
  }

  async listBatches() {
    const rows = await this.clickhouse.query<BatchRow>(
      `SELECT batchId, fileName, sheetName, rowCount, newRows, duplicateRows, skippedRows,
              minDate, maxDate,
              uploadedBy, uploadedByName,
              createdAt
       FROM negative_news_batches FINAL
       ORDER BY createdAt DESC
       LIMIT 50`,
    );
    return rows.map((r) => ({
      ...r,
      rowCount: Number(r.rowCount),
      newRows: Number(r.newRows),
      duplicateRows: Number(r.duplicateRows),
      skippedRows: Number(r.skippedRows),
    }));
  }

  /** Алдаатай оруулсан багцыг бүхэлд нь буцаана. */
  async deleteBatch(batchId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(batchId))
      throw new BadRequestException("Багцын дугаар буруу байна");
    const batch = await this.getBatch(batchId);
    if (!batch) throw new NotFoundException("Багц олдсонгүй");

    const counted = await this.clickhouse.query<{ c: string }>(
      `SELECT count() AS c FROM negative_news FINAL WHERE batchId = {batchId:String}`,
      { batchId },
    );
    await this.clickhouse.exec(
      `ALTER TABLE negative_news DELETE WHERE batchId = {batchId:String} SETTINGS mutations_sync = 1`,
      { batchId },
    );
    await this.clickhouse.exec(
      `ALTER TABLE negative_news_batches DELETE WHERE batchId = {batchId:String} SETTINGS mutations_sync = 1`,
      { batchId },
    );
    return { batchId, deletedRows: Number(counted[0]?.c ?? 0) };
  }

  // ─── Дашбоард ────────────────────────────────────────────────────────────

  /** Хугацаа + шүүлтүүрээр мэдээ уншина — дашбоард ба AI шинжилгээ хоёулаа ашиглана. */
  private async loadFiltered(dto: NegativeNewsDashboardDto) {
    const start = dto.startDate.slice(0, 10);
    const end = dto.endDate.slice(0, 10);
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = Date.parse(`${end}T00:00:00Z`);
    if (startMs > endMs)
      throw new BadRequestException("Эхлэх огноо дуусах огнооноос хойш байна");
    if ((endMs - startMs) / 86_400_000 > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Хугацааны хязгаар ${MAX_RANGE_DAYS} хоногоос хэтрэхгүй байх ёстой`,
      );
    }

    const rows = await this.clickhouse.query<NewsRow>(
      `SELECT rowHash, newsDate, channel, bank, category, content
       FROM negative_news FINAL
       WHERE newsDate BETWEEN {start:Date} AND {end:Date}
       ORDER BY newsDate DESC, rowHash
       LIMIT {limit:UInt32}`,
      { start, end, limit: MAX_SCAN_ROWS + 1 },
    );
    const truncated = rows.length > MAX_SCAN_ROWS;
    const inRange = rows.slice(0, MAX_SCAN_ROWS);

    const search = (dto.search ?? "").trim().toLowerCase();
    const filtered = inRange.filter(
      (r) =>
        (!dto.bank || r.bank === dto.bank) &&
        (!dto.channel || r.channel === dto.channel) &&
        (!dto.category || r.category === dto.category) &&
        (!search || r.content.toLowerCase().includes(search)),
    );
    return { startMs, endMs, inRange, filtered, truncated };
  }

  async dashboard(dto: NegativeNewsDashboardDto) {
    const { startMs, endMs, inRange, filtered, truncated } =
      await this.loadFiltered(dto);

    // Өдөр бүрийн тоо — мэдээгүй өдрийг 0-ээр бөглөнө (график тасрахгүй)
    const perDay = new Map<string, number>();
    for (const r of filtered)
      perDay.set(r.newsDate, (perDay.get(r.newsDate) ?? 0) + 1);
    const daily: { date: string; count: number }[] = [];
    for (let t = startMs; t <= endMs; t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      daily.push({ date, count: perDay.get(date) ?? 0 });
    }

    const distinct = (values: string[]) =>
      [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

    return {
      stats: {
        total: filtered.length,
        golomt: filtered.filter((r) => r.bank === GOLOMT_BANK).length,
        banks: new Set(filtered.map((r) => r.bank)).size,
        channels: new Set(filtered.map((r) => r.channel)).size,
      },
      daily,
      byChannel: countDesc(filtered.map((r) => r.channel)),
      byBank: countDesc(filtered.map((r) => r.bank)),
      byCategory: countDesc(filtered.map((r) => r.category)),
      items: filtered.slice(0, MAX_LIST_ROWS),
      matched: filtered.length,
      options: {
        banks: distinct(inRange.map((r) => r.bank)),
        channels: distinct(inRange.map((r) => r.channel)),
        categories: distinct(inRange.map((r) => r.category)),
      },
      truncated,
    };
  }

  /**
   * Эх скрипт шиг: Голомт банкны (банк сонгосон бол тэр банкны) мэдээний агуулгыг
   * даалгаврын хамт Together AI руу илгээж, хариуг мөр мөрөөр буцаана.
   */
  async aiInsights(dto: NegativeNewsAiDto) {
    const { filtered } = await this.loadFiltered(dto);
    const base = dto.bank
      ? filtered
      : filtered.filter((r) => r.bank === GOLOMT_BANK);
    if (base.length === 0) {
      throw new BadRequestException("Шинжлэх мэдээ алга байна");
    }

    const { message, used } = buildAiMessage(
      base.map((r) => r.content),
      buildAiPrompt(dto.instruction),
    );
    const text = await this.ai.complete(message);

    return {
      lines: parseAiLines(text),
      newsCount: used,
      candidateCount: base.length,
      model: this.ai.model,
      bank: dto.bank || GOLOMT_BANK,
    };
  }
}

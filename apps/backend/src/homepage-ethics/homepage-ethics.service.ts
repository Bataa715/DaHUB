import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { UserFacingBadRequestException } from "../common/exceptions/user-facing.exception";
import {
  CreateEthicsSlideDto,
  UpdateEthicsSlideDto,
} from "./dto/homepage-ethics.dto";

export interface EthicsSlide {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  is_active: 0 | 1;
  updated_by: string;
  seq: number;
  updated_at: string;
}

const DEFAULT_SLIDES: { title: string; body: string }[] = [
  {
    title: "Шударга байдал",
    body: "Аудитор нь үнэнч шударга байж, өөрийн дүгнэлтэд итгэх итгэлийг бий болгох үндсийг бүрдүүлнэ.",
  },
  {
    title: "Бодитой байдал",
    body: "Аудитор нь мэдээллийг цуглуулах, үнэлэх, тайлагнахдаа аливаа нөлөөнд автахгүйгээр тэнцвэртэй, шударга дүгнэлт гаргана.",
  },
  {
    title: "Нууцлалыг хадгалах",
    body: "Аудитор нь олж авсан мэдээллийн нууцыг хамгаалж, зөвшөөрөлгүйгээр задруулахгүй.",
  },
  {
    title: "Мэргэжлийн чадвар",
    body: "Аудитор нь ажлаа гүйцэтгэхэд шаардлагатай мэдлэг, ур чадвар, туршлагаа ашиглан чанартай, хариуцлагатай ажиллана.",
  },
];

function normalizeSlide(row: Record<string, unknown>): EthicsSlide {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    sort_order: Number(row.sort_order ?? 0),
    is_active: Number(row.is_active) === 1 ? 1 : 0,
    updated_by: String(row.updated_by ?? ""),
    seq: Number(row.seq ?? 0),
    updated_at: String(row.updated_at ?? ""),
  };
}

@Injectable()
export class HomepageEthicsService implements OnModuleInit {
  private readonly logger = new Logger(HomepageEthicsService.name);
  // [PERF] ensureTable() is also called from list/create/update/remove (not
  // just onModuleInit) — guard stops the CREATE TABLE DDL from re-running on
  // every request. Set true only after success so a transient failure retries.
  private tableEnsured = false;

  constructor(private readonly clickhouse: ClickHouseService) {}

  async onModuleInit() {
    try {
      await this.ensureTable();
      await this.seedIfEmpty();
    } catch (e) {
      this.logger.error(
        `homepage_ethics init failed: ${e instanceof Error ? e.message : e}`,
      );
      // App-ийг бүү унагаа — дараагийн request дээр дахин оролдоно
    }
  }

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS homepage_ethics_slides (
        id          String,
        title       String,
        body        String,
        sort_order  UInt32,
        is_active   UInt8,
        updated_by  String,
        seq         UInt64,
        updated_at  DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(seq)
      ORDER BY id
      SETTINGS index_granularity = 8192
    `);
    this.tableEnsured = true;
    this.logger.log("homepage_ethics_slides table ready");
  }

  private async seedIfEmpty(): Promise<void> {
    const rows = await this.clickhouse.query<{ c: string }>(`
      SELECT count() AS c
      FROM homepage_ethics_slides FINAL
      WHERE is_active = 1
    `);
    if (Number(rows[0]?.c ?? 0) > 0) return;

    const now = nowCH();
    const seq = Date.now();
    await this.clickhouse.insert(
      "homepage_ethics_slides",
      DEFAULT_SLIDES.map((s, i) => ({
        id: randomUUID(),
        title: s.title,
        body: s.body,
        sort_order: i + 1,
        is_active: 1,
        updated_by: "system",
        seq: seq + i,
        updated_at: now,
      })),
    );
    this.logger.log(`Seeded ${DEFAULT_SLIDES.length} default ethics slides`);
  }

  async list(activeOnly = true): Promise<EthicsSlide[]> {
    await this.ensureTable();
    const where = activeOnly ? "WHERE is_active = 1" : "";
    const rows = await this.clickhouse.query<Record<string, unknown>>(`
      SELECT *
      FROM homepage_ethics_slides FINAL
      ${where}
      ORDER BY sort_order ASC, updated_at DESC
    `);
    return (rows ?? []).map(normalizeSlide);
  }

  async create(
    dto: CreateEthicsSlideDto,
    updatedBy: string,
  ): Promise<EthicsSlide> {
    await this.ensureTable();
    const title = dto.title.trim();
    const body = dto.body.trim();
    if (!title || !body) {
      throw new UserFacingBadRequestException(
        "Гарчиг болон текст шаардлагатай",
      );
    }

    let sortOrder = dto.sort_order;
    if (sortOrder == null) {
      const max = await this.clickhouse.query<{ m: string }>(`
        SELECT max(sort_order) AS m
        FROM homepage_ethics_slides FINAL
        WHERE is_active = 1
      `);
      sortOrder = Number(max[0]?.m ?? 0) + 1;
    }

    const id = randomUUID();
    const record = {
      id,
      title,
      body,
      sort_order: sortOrder,
      is_active: 1,
      updated_by: updatedBy,
      seq: Date.now(),
      updated_at: nowCH(),
    };
    await this.clickhouse.insert("homepage_ethics_slides", [record]);

    // DB-ээс дахин уншиж буцаана (persist баталгаажуулах)
    const saved = await this.clickhouse.query<Record<string, unknown>>(
      `SELECT * FROM homepage_ethics_slides FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!saved[0] || Number(saved[0].is_active) !== 1) {
      this.logger.error(`Ethics slide insert not visible after write: ${id}`);
      throw new UserFacingBadRequestException(
        "Хадгалалт амжилтгүй. ClickHouse холболт/эрхээ шалгана уу.",
      );
    }
    return normalizeSlide(saved[0]);
  }

  async update(
    id: string,
    dto: UpdateEthicsSlideDto,
    updatedBy: string,
  ): Promise<EthicsSlide> {
    await this.ensureTable();
    const existing = await this.clickhouse.query<Record<string, unknown>>(
      `SELECT * FROM homepage_ethics_slides FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    const base = existing[0];
    if (!base || Number(base.is_active) === 0) {
      throw new NotFoundException("Текст олдсонгүй");
    }

    const record = {
      id: String(base.id),
      title: dto.title?.trim() ?? String(base.title ?? ""),
      body: dto.body?.trim() ?? String(base.body ?? ""),
      sort_order: dto.sort_order ?? Number(base.sort_order ?? 0),
      is_active: 1,
      updated_by: updatedBy,
      seq: Date.now(),
      updated_at: nowCH(),
    };
    await this.clickhouse.insert("homepage_ethics_slides", [record]);

    const saved = await this.clickhouse.query<Record<string, unknown>>(
      `SELECT * FROM homepage_ethics_slides FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    return normalizeSlide(saved[0] ?? record);
  }

  async remove(id: string, updatedBy: string): Promise<void> {
    await this.ensureTable();
    const existing = await this.clickhouse.query<Record<string, unknown>>(
      `SELECT * FROM homepage_ethics_slides FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!existing.length) return;
    const row = existing[0];
    await this.clickhouse.insert("homepage_ethics_slides", [
      {
        id: String(row.id),
        title: String(row.title ?? ""),
        body: String(row.body ?? ""),
        sort_order: Number(row.sort_order ?? 0),
        is_active: 0,
        updated_by: updatedBy,
        seq: Date.now(),
        updated_at: nowCH(),
      },
    ]);
  }
}

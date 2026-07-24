import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";

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

@Injectable()
export class HomepageEthicsService implements OnModuleInit {
  private readonly logger = new Logger(HomepageEthicsService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTable();
    await this.seedIfEmpty();
  }

  private async ensureTable(): Promise<void> {
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
    const where = activeOnly ? "WHERE is_active = 1" : "";
    return this.clickhouse.query<EthicsSlide>(`
      SELECT *
      FROM homepage_ethics_slides FINAL
      ${where}
      ORDER BY sort_order ASC, updated_at DESC
    `);
  }

  async create(
    dto: { title: string; body: string; sort_order?: number },
    updatedBy: string,
  ): Promise<EthicsSlide> {
    const title = dto.title.trim();
    const body = dto.body.trim();
    if (!title || !body) {
      throw new BadRequestException("Гарчиг болон текст шаардлагатай");
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

    const record: EthicsSlide = {
      id: randomUUID(),
      title,
      body,
      sort_order: sortOrder,
      is_active: 1,
      updated_by: updatedBy,
      seq: Date.now(),
      updated_at: nowCH(),
    };
    await this.clickhouse.insert("homepage_ethics_slides", [
      record as unknown as Record<string, unknown>,
    ]);
    return record;
  }

  async update(
    id: string,
    dto: Partial<{ title: string; body: string; sort_order: number }>,
    updatedBy: string,
  ): Promise<EthicsSlide> {
    const existing = await this.clickhouse.query<EthicsSlide>(
      `SELECT * FROM homepage_ethics_slides FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    const base = existing[0];
    if (!base || base.is_active === 0) {
      throw new NotFoundException("Текст олдсонгүй");
    }

    const record: EthicsSlide = {
      ...base,
      title: dto.title?.trim() ?? base.title,
      body: dto.body?.trim() ?? base.body,
      sort_order: dto.sort_order ?? base.sort_order,
      updated_by: updatedBy,
      seq: Date.now(),
      updated_at: nowCH(),
    };
    await this.clickhouse.insert("homepage_ethics_slides", [
      record as unknown as Record<string, unknown>,
    ]);
    return record;
  }

  async remove(id: string, updatedBy: string): Promise<void> {
    const existing = await this.clickhouse.query<EthicsSlide>(
      `SELECT * FROM homepage_ethics_slides FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!existing.length) return;
    const row = existing[0];
    await this.clickhouse.insert("homepage_ethics_slides", [
      {
        ...row,
        is_active: 0,
        updated_by: updatedBy,
        seq: Date.now(),
        updated_at: nowCH(),
      },
    ]);
  }
}

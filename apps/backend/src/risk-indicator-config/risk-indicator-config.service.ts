import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface IndicatorConfig {
  id: string;
  subid: string;
  name: string;
  group_num: number;
  sort_order: number;
  weight: number;
  is_manual: 0 | 1;
  is_judgment: 0 | 1;
  is_active: 0 | 1;
  score_scale: string; // JSON string
  hint: string;
  updated_by: string;
  seq: number;
  updated_at: string;
}

export interface GroupConfig {
  region: string;
  group_num: number;
  weight: number;
  label: string;
  seq: number;
  updated_at: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class RiskIndicatorConfigService implements OnModuleInit {
  private readonly logger = new Logger(RiskIndicatorConfigService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  // ── Schema ─────────────────────────────────────────────────────────────────

  private async ensureTables(): Promise<void> {
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_indicator_config (
        id          String,
        subid       String,
        name        String,
        group_num   UInt8,
        sort_order  UInt32,
        weight      Float64,
        is_manual   UInt8,
        is_judgment UInt8,
        is_active   UInt8,
        score_scale String,
        hint        String,
        updated_by  String,
        seq         UInt64,
        updated_at  DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(seq)
      ORDER BY id
      SETTINGS index_granularity = 8192
    `);

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS risk_group_config (
        region      String,
        group_num   UInt8,
        weight      Float64,
        label       String,
        seq         UInt64,
        updated_at  DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(seq)
      ORDER BY (region, group_num)
      SETTINGS index_granularity = 8192
    `);

    this.logger.log("risk_indicator_config and risk_group_config tables ready");
  }

  // ── Indicators ─────────────────────────────────────────────────────────────

  async listIndicators(): Promise<IndicatorConfig[]> {
    return this.clickhouse.query<IndicatorConfig>(`
      SELECT *
      FROM risk_indicator_config FINAL
      WHERE is_active = 1
      ORDER BY group_num ASC, sort_order ASC, id ASC
    `);
  }

  async upsertIndicator(
    dto: {
      id?: string;
      subid: string;
      name: string;
      group_num: number;
      sort_order?: number;
      weight: number;
      is_manual: 0 | 1;
      is_judgment: 0 | 1;
      score_scale: string;
      hint?: string;
    },
    updatedBy: string,
  ): Promise<IndicatorConfig> {
    const seq = Date.now();
    const now = nowCH();

    let record: IndicatorConfig;

    if (dto.id) {
      // Update: fetch existing to merge fields
      const existing = await this.clickhouse.query<IndicatorConfig>(
        `
        SELECT * FROM risk_indicator_config FINAL WHERE id = {id:String} LIMIT 1
      `,
        { id: dto.id },
      );

      const base = existing[0] ?? {};
      record = {
        id: dto.id,
        subid: dto.subid ?? (base as any).subid ?? dto.id,
        name: dto.name ?? (base as any).name ?? "",
        group_num: dto.group_num ?? (base as any).group_num ?? 1,
        sort_order: dto.sort_order ?? (base as any).sort_order ?? 0,
        weight: dto.weight ?? (base as any).weight ?? 0,
        is_manual: dto.is_manual ?? (base as any).is_manual ?? 0,
        is_judgment: dto.is_judgment ?? (base as any).is_judgment ?? 0,
        is_active: (base as any).is_active ?? 1,
        score_scale: dto.score_scale ?? (base as any).score_scale ?? "{}",
        hint: dto.hint ?? (base as any).hint ?? "",
        updated_by: updatedBy,
        seq,
        updated_at: now,
      };
    } else {
      // Insert: new record
      record = {
        id: randomUUID(),
        subid: dto.subid,
        name: dto.name,
        group_num: dto.group_num,
        sort_order: dto.sort_order ?? 0,
        weight: dto.weight,
        is_manual: dto.is_manual,
        is_judgment: dto.is_judgment,
        is_active: 1,
        score_scale: dto.score_scale,
        hint: dto.hint ?? "",
        updated_by: updatedBy,
        seq,
        updated_at: now,
      };
    }

    await this.clickhouse.insert("risk_indicator_config", [record as unknown as Record<string, unknown>]);
    return record;
  }

  async deleteIndicator(id: string, updatedBy: string): Promise<void> {
    const existing = await this.clickhouse.query<IndicatorConfig>(
      `
      SELECT * FROM risk_indicator_config FINAL WHERE id = {id:String} LIMIT 1
    `,
      { id },
    );

    if (!existing.length) return;

    const row = existing[0];
    await this.clickhouse.insert("risk_indicator_config", [
      {
        ...row,
        is_active: 0,
        updated_by: updatedBy,
        seq: Date.now(),
        updated_at: nowCH(),
      },
    ]);
  }

  async reorderIndicators(ids: string[], updatedBy: string): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const existing = await this.clickhouse.query<IndicatorConfig>(
        `
        SELECT * FROM risk_indicator_config FINAL WHERE id = {id:String} LIMIT 1
      `,
        { id },
      );

      if (!existing.length) continue;

      await this.clickhouse.insert("risk_indicator_config", [
        {
          ...existing[0],
          sort_order: i * 10,
          updated_by: updatedBy,
          seq: Date.now(),
          updated_at: nowCH(),
        },
      ]);
    }
  }

  // ── Group Config ───────────────────────────────────────────────────────────

  async listGroupConfig(): Promise<GroupConfig[]> {
    return this.clickhouse.query<GroupConfig>(`
      SELECT *
      FROM risk_group_config FINAL
      ORDER BY region ASC, group_num ASC
    `);
  }

}

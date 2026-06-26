import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";

export interface OracleDashboardConfig {
  id: number;
  name: string;
  tableName: string;
  fromClause?: string;
  cifColumn: string;
  dateColumn: string | null;
  amountColumn: string | null;
  enabled: boolean;
}

export interface EventChainConfig {
  id: number;
  name: string;
  description: string;
  sourceLabel: string;
  targetLabel: string;
  sourceIds: number[];
  targetIds: number[];
  enabled: boolean;
}

type DashboardRow = {
  id: number;
  name: string;
  table_name: string;
  from_clause: string;
  cif_column: string;
  date_column: string;
  amount_column: string;
  enabled: number;
  is_active: number;
};

type ChainRow = {
  id: number;
  name: string;
  description: string;
  source_label: string;
  target_label: string;
  source_ids: string;
  target_ids: string;
  enabled: number;
  is_active: number;
};

const IDENT_RE = /^[A-Z_][A-Z0-9_.]*$/i;

@Injectable()
export class OracleConfigService implements OnModuleInit {
  private readonly logger = new Logger(OracleConfigService.name);
  private dashboardsCache: OracleDashboardConfig[] = [];
  private chainsCache: EventChainConfig[] = [];

  constructor(private readonly clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.refreshCache();
    this.logger.log(
      `Oracle config loaded: ${this.dashboardsCache.length} dashboards, ${this.chainsCache.length} chains`,
    );
  }

  // ─── Read (sync, from cache) ───────────────────────────────────────────────

  loadDashboards(): OracleDashboardConfig[] {
    return this.dashboardsCache;
  }

  getEnabledDashboards(): OracleDashboardConfig[] {
    return this.dashboardsCache.filter((d) => d.enabled);
  }

  loadChains(): EventChainConfig[] {
    return this.chainsCache;
  }

  getEnabledChains(): EventChainConfig[] {
    return this.chainsCache.filter((c) => c.enabled);
  }

  // ─── Dashboard CRUD ──────────────────────────────────────────────────────

  async createDashboard(
    dto: {
      name: string;
      tableName: string;
      fromClause?: string;
      cifColumn: string;
      dateColumn?: string | null;
      amountColumn?: string | null;
      enabled?: boolean;
    },
  ): Promise<OracleDashboardConfig> {
    this.validateDashboardFields({
      name: dto.name,
      tableName: dto.tableName,
      cifColumn: dto.cifColumn,
      dateColumn: dto.dateColumn ?? null,
      amountColumn: dto.amountColumn ?? null,
    });
    const nextId = await this.nextDashboardId();
    const record: OracleDashboardConfig = {
      id: nextId,
      name: dto.name.trim(),
      tableName: dto.tableName.trim(),
      fromClause: dto.fromClause?.trim() || undefined,
      cifColumn: dto.cifColumn.trim(),
      dateColumn: dto.dateColumn?.trim() || null,
      amountColumn: dto.amountColumn?.trim() || null,
      enabled: dto.enabled !== false,
    };
    await this.persistDashboard(record, 1);
    await this.refreshCache();
    return record;
  }

  async updateDashboard(
    id: number,
    dto: Partial<Omit<OracleDashboardConfig, "id">>,
  ): Promise<OracleDashboardConfig> {
    const existing = this.dashboardsCache.find((d) => d.id === id);
    if (!existing) throw new NotFoundException(`Dashboard олдсонгүй: id=${id}`);

    const merged: OracleDashboardConfig = {
      ...existing,
      ...dto,
      id,
      name: (dto.name ?? existing.name).trim(),
      tableName: (dto.tableName ?? existing.tableName).trim(),
      fromClause: dto.fromClause !== undefined
        ? dto.fromClause?.trim() || undefined
        : existing.fromClause,
      cifColumn: (dto.cifColumn ?? existing.cifColumn).trim(),
      dateColumn:
        dto.dateColumn !== undefined
          ? dto.dateColumn?.trim() || null
          : existing.dateColumn,
      amountColumn:
        dto.amountColumn !== undefined
          ? dto.amountColumn?.trim() || null
          : existing.amountColumn,
      enabled: dto.enabled ?? existing.enabled,
    };
    this.validateDashboardFields(merged);
    await this.persistDashboard(merged, 1);
    await this.refreshCache();
    return merged;
  }

  async setDashboardEnabled(
    id: number,
    enabled: boolean,
  ): Promise<OracleDashboardConfig> {
    return this.updateDashboard(id, { enabled });
  }

  async deleteDashboard(id: number): Promise<void> {
    const existing = this.dashboardsCache.find((d) => d.id === id);
    if (!existing) throw new NotFoundException(`Dashboard олдсонгүй: id=${id}`);
    await this.persistDashboard(existing, 0);
    await this.refreshCache();
  }

  // ─── Chain CRUD ────────────────────────────────────────────────────────────

  async createChain(
    dto: {
      name: string;
      description?: string;
      sourceLabel?: string;
      targetLabel?: string;
      sourceIds: number[];
      targetIds: number[];
      enabled?: boolean;
    },
  ): Promise<EventChainConfig> {
    this.validateChainFields(dto);
    const nextId = await this.nextChainId();
    const record: EventChainConfig = {
      id: nextId,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? "",
      sourceLabel: dto.sourceLabel?.trim() ?? "",
      targetLabel: dto.targetLabel?.trim() ?? "",
      sourceIds: dto.sourceIds ?? [],
      targetIds: dto.targetIds ?? [],
      enabled: dto.enabled !== false,
    };
    await this.persistChain(record, 1);
    await this.refreshCache();
    return record;
  }

  async updateChain(
    id: number,
    dto: Partial<Omit<EventChainConfig, "id">>,
  ): Promise<EventChainConfig> {
    const existing = this.chainsCache.find((c) => c.id === id);
    if (!existing) throw new NotFoundException(`Event chain олдсонгүй: id=${id}`);

    const merged: EventChainConfig = {
      ...existing,
      ...dto,
      id,
      name: (dto.name ?? existing.name).trim(),
      description: (dto.description ?? existing.description).trim(),
      sourceLabel: (dto.sourceLabel ?? existing.sourceLabel).trim(),
      targetLabel: (dto.targetLabel ?? existing.targetLabel).trim(),
      sourceIds: dto.sourceIds ?? existing.sourceIds,
      targetIds: dto.targetIds ?? existing.targetIds,
      enabled: dto.enabled ?? existing.enabled,
    };
    this.validateChainFields(merged);
    await this.persistChain(merged, 1);
    await this.refreshCache();
    return merged;
  }

  async setChainEnabled(id: number, enabled: boolean): Promise<EventChainConfig> {
    return this.updateChain(id, { enabled });
  }

  async deleteChain(id: number): Promise<void> {
    const existing = this.chainsCache.find((c) => c.id === id);
    if (!existing) throw new NotFoundException(`Event chain олдсонгүй: id=${id}`);
    await this.persistChain(existing, 0);
    await this.refreshCache();
  }

  validateIdentifier(name: string, value: string) {
    if (!IDENT_RE.test(value)) {
      throw new BadRequestException(
        `${name} буруу формат. Зөвхөн [A-Z0-9_.] зөвшөөрнө`,
      );
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async ensureTables(): Promise<void> {
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS oracle_dashboard_config (
        id             UInt32,
        name           String,
        table_name     String,
        from_clause    String DEFAULT '',
        cif_column     String,
        date_column    String DEFAULT '',
        amount_column  String DEFAULT '',
        enabled        UInt8 DEFAULT 1,
        is_active      UInt8 DEFAULT 1,
        seq            UInt64,
        updated_at     DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(seq)
      ORDER BY id
      SETTINGS index_granularity = 8192
    `);

    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS oracle_event_chain_config (
        id            UInt32,
        name          String,
        description   String DEFAULT '',
        source_label  String DEFAULT '',
        target_label  String DEFAULT '',
        source_ids    String DEFAULT '[]',
        target_ids    String DEFAULT '[]',
        enabled       UInt8 DEFAULT 1,
        is_active     UInt8 DEFAULT 1,
        seq           UInt64,
        updated_at    DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(seq)
      ORDER BY id
      SETTINGS index_granularity = 8192
    `);
  }

  private async refreshCache(): Promise<void> {
    this.dashboardsCache = await this.queryDashboards();
    this.chainsCache = await this.queryChains();
  }

  private async queryDashboards(): Promise<OracleDashboardConfig[]> {
    const rows = await this.clickhouse.query<DashboardRow>(`
      SELECT *
      FROM oracle_dashboard_config FINAL
      WHERE is_active = 1
      ORDER BY id ASC
    `);
    return rows.map((r) => this.rowToDashboard(r));
  }

  private async queryChains(): Promise<EventChainConfig[]> {
    const rows = await this.clickhouse.query<ChainRow>(`
      SELECT *
      FROM oracle_event_chain_config FINAL
      WHERE is_active = 1
      ORDER BY id ASC
    `);
    return rows.map((r) => this.rowToChain(r));
  }

  private rowToDashboard(r: DashboardRow): OracleDashboardConfig {
    return {
      id: Number(r.id),
      name: String(r.name),
      tableName: String(r.table_name),
      fromClause: r.from_clause ? String(r.from_clause) : undefined,
      cifColumn: String(r.cif_column),
      dateColumn: r.date_column ? String(r.date_column) : null,
      amountColumn: r.amount_column ? String(r.amount_column) : null,
      enabled: Number(r.enabled) === 1,
    };
  }

  private rowToChain(r: ChainRow): EventChainConfig {
    return {
      id: Number(r.id),
      name: String(r.name),
      description: String(r.description ?? ""),
      sourceLabel: String(r.source_label ?? ""),
      targetLabel: String(r.target_label ?? ""),
      sourceIds: this.parseIdArray(r.source_ids),
      targetIds: this.parseIdArray(r.target_ids),
      enabled: Number(r.enabled) === 1,
    };
  }

  private parseIdArray(raw: string): number[] {
    try {
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map((n) => Number(n)).filter((n) => !isNaN(n));
    } catch {
      return [];
    }
  }

  private async nextDashboardId(): Promise<number> {
    const rows = await this.clickhouse.query<{ maxId: number }>(
      `SELECT max(id) AS maxId FROM oracle_dashboard_config FINAL`,
    );
    return Number(rows[0]?.maxId ?? 0) + 1;
  }

  private async nextChainId(): Promise<number> {
    const rows = await this.clickhouse.query<{ maxId: number }>(
      `SELECT max(id) AS maxId FROM oracle_event_chain_config FINAL`,
    );
    return Number(rows[0]?.maxId ?? 0) + 1;
  }

  private async persistDashboard(
    d: OracleDashboardConfig,
    isActive: number,
  ): Promise<void> {
    await this.clickhouse.insert("oracle_dashboard_config", [
      {
        id: d.id,
        name: d.name,
        table_name: d.tableName,
        from_clause: d.fromClause ?? "",
        cif_column: d.cifColumn,
        date_column: d.dateColumn ?? "",
        amount_column: d.amountColumn ?? "",
        enabled: d.enabled ? 1 : 0,
        is_active: isActive,
        seq: Date.now(),
        updated_at: nowCH(),
      },
    ]);
  }

  private async persistChain(c: EventChainConfig, isActive: number): Promise<void> {
    await this.clickhouse.insert("oracle_event_chain_config", [
      {
        id: c.id,
        name: c.name,
        description: c.description,
        source_label: c.sourceLabel,
        target_label: c.targetLabel,
        source_ids: JSON.stringify(c.sourceIds ?? []),
        target_ids: JSON.stringify(c.targetIds ?? []),
        enabled: c.enabled ? 1 : 0,
        is_active: isActive,
        seq: Date.now(),
        updated_at: nowCH(),
      },
    ]);
  }

  private validateDashboardFields(
    d: Pick<
      OracleDashboardConfig,
      "name" | "tableName" | "cifColumn" | "dateColumn" | "amountColumn"
    >,
  ) {
    if (!d.name?.trim()) {
      throw new BadRequestException("Нэр шаардлагатай");
    }
    if (!d.tableName?.trim()) {
      throw new BadRequestException("Хүснэгтийн нэр шаардлагатай");
    }
    this.validateIdentifier("tableName", d.tableName.trim());
    this.validateIdentifier("cifColumn", d.cifColumn.trim());
    if (d.dateColumn?.trim()) {
      this.validateIdentifier("dateColumn", d.dateColumn.trim());
    }
    if (d.amountColumn?.trim()) {
      this.validateIdentifier("amountColumn", d.amountColumn.trim());
    }
  }

  private validateChainFields(
    c: Pick<
      EventChainConfig,
      "name" | "sourceIds" | "targetIds"
    >,
  ) {
    if (!c.name?.trim()) {
      throw new BadRequestException("Нэр шаардлагатай");
    }
    if (!c.sourceIds?.length) {
      throw new BadRequestException("sourceIds хоосон байж болохгүй");
    }
    if (!c.targetIds?.length) {
      throw new BadRequestException("targetIds хоосон байж болохгүй");
    }
  }
}

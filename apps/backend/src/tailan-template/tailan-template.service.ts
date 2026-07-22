import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import {
  DEFAULT_DEPARTMENT_ID,
  TailanSectionDef,
  TailanTemplate,
  TailanTemplateScope,
} from "./tailan-template.types";
import { legacySectionsFor } from "./legacy-templates";

interface TailanTemplateRow {
  id: string;
  departmentId: string;
  scope: TailanTemplateScope;
  name: string;
  sectionsJson: string;
  isActive: 0 | 1;
  updatedBy: string;
  seq: number;
  updatedAt: string;
}

@Injectable()
export class TailanTemplateService implements OnModuleInit {
  private readonly logger = new Logger(TailanTemplateService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.seedDefaultsIfMissing();
  }

  // ── Schema ─────────────────────────────────────────────────────────────────

  private async ensureTables(): Promise<void> {
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS tailan_templates (
        id           String,
        departmentId String,
        scope        String,
        name         String,
        sectionsJson String,
        isActive     UInt8,
        updatedBy    String,
        seq          UInt64,
        updatedAt    DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(seq)
      ORDER BY id
      SETTINGS index_granularity = 8192
    `);
    this.logger.log("tailan_templates table ready");
  }

  /** Ensures a global "default" template exists for both scopes, seeded from
   * the legacy hardcoded section structure — so every department/user has a
   * working template out of the box before any admin customizes one. */
  private async seedDefaultsIfMissing(): Promise<void> {
    for (const scope of ["employee", "department"] as TailanTemplateScope[]) {
      const existing = await this.findRow(DEFAULT_DEPARTMENT_ID, scope);
      if (existing) continue;
      await this.upsertRow({
        id: randomUUID(),
        departmentId: DEFAULT_DEPARTMENT_ID,
        scope,
        name:
          scope === "employee"
            ? "Үндсэн загвар (ажилтан)"
            : "Үндсэн загвар (хэлтэс)",
        sections: legacySectionsFor(scope),
        isActive: 1,
        updatedBy: "system",
      });
      this.logger.log(`Seeded default ${scope} template`);
    }
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  async list(scope?: TailanTemplateScope): Promise<TailanTemplate[]> {
    const rows = await this.clickhouse.query<TailanTemplateRow>(
      scope
        ? `SELECT * FROM tailan_templates FINAL WHERE scope = {scope:String} ORDER BY departmentId ASC`
        : `SELECT * FROM tailan_templates FINAL ORDER BY scope ASC, departmentId ASC`,
      scope ? { scope } : {},
    );
    return rows.map(this.rowToTemplate);
  }

  private async findRow(
    departmentId: string,
    scope: TailanTemplateScope,
  ): Promise<TailanTemplateRow | null> {
    const rows = await this.clickhouse.query<TailanTemplateRow>(
      `SELECT * FROM tailan_templates FINAL
       WHERE departmentId = {departmentId:String} AND scope = {scope:String}
       LIMIT 1`,
      { departmentId, scope },
    );
    return rows[0] ?? null;
  }

  /** Active template for a department: department-specific row if present,
   * otherwise the global "default" template for that scope. */
  async getActive(
    departmentId: string | undefined,
    scope: TailanTemplateScope,
  ): Promise<TailanTemplate> {
    if (departmentId) {
      const own = await this.findRow(departmentId, scope);
      if (own) return this.rowToTemplate(own);
    }
    const fallback = await this.findRow(DEFAULT_DEPARTMENT_ID, scope);
    if (fallback) return this.rowToTemplate(fallback);
    // Extremely defensive fallback in case seeding hasn't run yet.
    return {
      id: "in-memory-fallback",
      departmentId: DEFAULT_DEPARTMENT_ID,
      scope,
      name: "Үндсэн загвар",
      sections: legacySectionsFor(scope),
      isActive: 1,
      updatedBy: "system",
      seq: 0,
      updatedAt: nowCH(),
    };
  }

  async getById(id: string): Promise<TailanTemplate> {
    const rows = await this.clickhouse.query<TailanTemplateRow>(
      `SELECT * FROM tailan_templates FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!rows.length) throw new NotFoundException("Загвар олдсонгүй");
    return this.rowToTemplate(rows[0]);
  }

  // ── Writes (admin only, enforced at controller level) ───────────────────────

  async upsert(
    dto: {
      id?: string;
      departmentId: string;
      scope: TailanTemplateScope;
      name: string;
      sections: TailanSectionDef[];
    },
    updatedBy: string,
  ): Promise<TailanTemplate> {
    return this.upsertRow({
      id: dto.id ?? randomUUID(),
      departmentId: dto.departmentId || DEFAULT_DEPARTMENT_ID,
      scope: dto.scope,
      name: dto.name,
      sections: dto.sections,
      isActive: 1,
      updatedBy,
    });
  }

  async delete(id: string): Promise<void> {
    const tpl = await this.getById(id);
    if (tpl.departmentId === DEFAULT_DEPARTMENT_ID) {
      throw new NotFoundException("Үндсэн загварыг устгах боломжгүй");
    }
    await this.clickhouse.exec(
      `ALTER TABLE tailan_templates DELETE WHERE id = {id:String}`,
      { id },
    );
  }

  private async upsertRow(row: {
    id: string;
    departmentId: string;
    scope: TailanTemplateScope;
    name: string;
    sections: TailanSectionDef[];
    isActive: 0 | 1;
    updatedBy: string;
  }): Promise<TailanTemplate> {
    const seq = Date.now();
    const updatedAt = nowCH();
    await this.clickhouse.insert("tailan_templates", [
      {
        id: row.id,
        departmentId: row.departmentId,
        scope: row.scope,
        name: row.name,
        sectionsJson: JSON.stringify(
          [...row.sections].sort((a, b) => a.order - b.order),
        ),
        isActive: row.isActive,
        updatedBy: row.updatedBy,
        seq,
        updatedAt,
      },
    ]);
    return {
      ...row,
      sections: row.sections,
      seq,
      updatedAt,
    };
  }

  private rowToTemplate = (row: TailanTemplateRow): TailanTemplate => {
    let sections: TailanSectionDef[] = [];
    try {
      sections = JSON.parse(row.sectionsJson || "[]");
    } catch {
      sections = [];
    }
    return {
      id: row.id,
      departmentId: row.departmentId,
      scope: row.scope,
      name: row.name,
      sections,
      isActive: row.isActive,
      updatedBy: row.updatedBy,
      seq: row.seq,
      updatedAt: row.updatedAt,
    };
  };
}

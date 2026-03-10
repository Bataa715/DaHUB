import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  OnModuleInit,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  RunReportDto,
} from "./dto/excel-report.dto";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  pythonCode: string;
  dateMode: "none" | "single" | "range";
  color: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ExcelReportService implements OnModuleInit {
  private readonly logger = new Logger(ExcelReportService.name);

  constructor(private clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTableExists();
  }

  private async ensureTableExists() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS excel_report_templates (
          id        String,
          name      String,
          description String DEFAULT '',
          pythonCode  String,
          dateMode    String DEFAULT 'range',
          color       String DEFAULT 'from-blue-500 to-cyan-500',
          isActive    UInt8  DEFAULT 1,
          seq         UInt64,
          createdAt   DateTime DEFAULT now(),
          updatedAt   String DEFAULT ''
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);
    } catch (e) {
      this.logger.error("Failed to ensure excel_report_templates table:", e);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getLatestTemplates(
    activeOnly = false,
  ): Promise<ReportTemplate[]> {
    const where = activeOnly ? "WHERE isActive = 1" : "";
    const rows = await this.clickhouse.query<ReportTemplate>(
      `SELECT *
       FROM (
         SELECT
           id,
           argMax(name, seq)        AS name,
           argMax(description, seq) AS description,
           argMax(pythonCode, seq)  AS pythonCode,
           argMax(dateMode, seq)    AS dateMode,
           argMax(color, seq)       AS color,
           argMax(isActive, seq)    AS isActive,
           argMax(updatedAt, seq)   AS updatedAt,
           min(createdAt)           AS createdAt
         FROM excel_report_templates
         GROUP BY id
       )
       ${where}
       ORDER BY createdAt ASC`,
    );
    return rows || [];
  }

  private async getTemplateById(id: string): Promise<ReportTemplate> {
    const rows = await this.clickhouse.query<ReportTemplate>(
      `SELECT
         id,
         argMax(name, seq)        AS name,
         argMax(description, seq) AS description,
         argMax(pythonCode, seq)  AS pythonCode,
         argMax(dateMode, seq)    AS dateMode,
         argMax(color, seq)       AS color,
         argMax(isActive, seq)    AS isActive,
         argMax(updatedAt, seq)   AS updatedAt,
         min(createdAt)           AS createdAt
       FROM excel_report_templates
       WHERE id = {id:String}
       GROUP BY id`,
      { id },
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException("Загвар олдсонгүй");
    }
    return rows[0];
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async getAllTemplates(): Promise<ReportTemplate[]> {
    return this.getLatestTemplates(false);
  }

  async createTemplate(dto: CreateReportTemplateDto): Promise<ReportTemplate> {
    const id = randomUUID();
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("excel_report_templates", [
      {
        id,
        name: dto.name,
        description: dto.description ?? "",
        pythonCode: dto.pythonCode,
        dateMode: dto.dateMode,
        color: dto.color ?? "from-blue-500 to-cyan-500",
        isActive: 1,
        seq,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    return this.getTemplateById(id);
  }

  async updateTemplate(
    id: string,
    dto: UpdateReportTemplateDto,
  ): Promise<ReportTemplate> {
    const existing = await this.getTemplateById(id);
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("excel_report_templates", [
      {
        id,
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        pythonCode: dto.pythonCode ?? existing.pythonCode,
        dateMode: dto.dateMode ?? existing.dateMode,
        color: dto.color ?? existing.color,
        isActive: existing.isActive,
        seq,
        createdAt: existing.createdAt,
        updatedAt: now,
      },
    ]);
    return this.getTemplateById(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<ReportTemplate> {
    const existing = await this.getTemplateById(id);
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("excel_report_templates", [
      {
        id,
        name: existing.name,
        description: existing.description,
        pythonCode: existing.pythonCode,
        dateMode: existing.dateMode,
        color: existing.color,
        isActive: isActive ? 1 : 0,
        seq,
        createdAt: existing.createdAt,
        updatedAt: now,
      },
    ]);
    return this.getTemplateById(id);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.getTemplateById(id);
    await this.clickhouse.exec(
      `ALTER TABLE excel_report_templates DELETE WHERE id = '${id}'`,
    );
  }

  // ── User: list active templates ────────────────────────────────────────────

  async getActiveTemplates(): Promise<
    Omit<ReportTemplate, "pythonCode" | "isActive">[]
  > {
    const all = await this.getLatestTemplates(true);
    return all.map(({ pythonCode: _p, isActive: _a, ...rest }) => rest);
  }

  // ── Run report ─────────────────────────────────────────────────────────────

  async runReport(dto: RunReportDto): Promise<Buffer> {
    const template = await this.getTemplateById(dto.templateId);
    if (!template.isActive) {
      throw new BadRequestException("Энэ тайлан идэвхгүй байна");
    }

    // Validate date inputs
    if (template.dateMode === "range") {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException("Эхлэх болон дуусах огноо шаардлагатай");
      }
    }
    if (template.dateMode === "single") {
      if (!dto.startDate) {
        throw new BadRequestException("Огноо шаардлагатай");
      }
    }

    // Write python code to a temp file
    const tmpDir = os.tmpdir();
    const scriptPath = path.join(tmpDir, `excel_report_${randomUUID()}.py`);
    const outputPath = path.join(tmpDir, `excel_report_${randomUUID()}.xlsx`);

    try {
      fs.writeFileSync(scriptPath, template.pythonCode, "utf8");

      // Build env — pass ClickHouse connection + date params
      const env: Record<string, string> = {
        ...process.env,
        CLICKHOUSE_HOST: process.env.CLICKHOUSE_HOST ?? "",
        CLICKHOUSE_USER: process.env.CLICKHOUSE_USER ?? "default",
        CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD ?? "",
        CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE ?? "audit_db",
        OUTPUT_FILE: outputPath,
        START_DATE: dto.startDate ?? "",
        END_DATE: dto.endDate ?? dto.startDate ?? "",
        REPORT_NAME: template.name,
      };

      await this.executePython(scriptPath, env);

      if (!fs.existsSync(outputPath)) {
        throw new InternalServerErrorException(
          "Python скрипт Excel файл үүсгээгүй байна. OUTPUT_FILE замд файл хадгалах шаардлагатай.",
        );
      }

      const buffer = fs.readFileSync(outputPath);
      return buffer;
    } finally {
      // Cleanup temp files
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
      try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}
    }
  }

  private executePython(
    scriptPath: string,
    env: Record<string, string>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const python = spawn("python3", [scriptPath], {
        env,
        timeout: 120000, // 2 min max
      });

      let stderr = "";
      python.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      python.on("close", (code: number) => {
        if (code !== 0) {
          reject(
            new InternalServerErrorException(
              `Python скрипт алдаатай дуусгав (code ${code}):\n${stderr.slice(0, 500)}`,
            ),
          );
        } else {
          resolve();
        }
      });

      python.on("error", (err: Error) => {
        reject(
          new InternalServerErrorException(
            `Python ажиллуулах боломжгүй: ${err.message}`,
          ),
        );
      });
    });
  }
}

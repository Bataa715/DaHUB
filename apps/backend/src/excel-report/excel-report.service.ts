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
  QueryToExcelDto,
} from "./dto/excel-report.dto";
import { randomUUID } from "crypto";
import * as http from "http";
import { PassThrough } from "stream";
import ExcelJS from "exceljs";

export interface FilterDef {
  key: string;
  label: string;
  placeholder?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  pythonCode: string;
  dateMode: "none" | "single" | "range";
  color: string;
  filters: string; // JSON string of FilterDef[]
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

// ── Async job types ────────────────────────────────────────────────────────
type JobStatus = "pending" | "running" | "done" | "error";

interface ReportJob {
  id: string;
  status: JobStatus;
  startedAt: number;
  finishedAt?: number;
  fileName?: string;
  error?: string;
  buffer?: Buffer;
}

@Injectable()
export class ExcelReportService implements OnModuleInit {
  private readonly logger = new Logger(ExcelReportService.name);

  // In-memory job store — single-instance singleton is fine
  private readonly jobs = new Map<string, ReportJob>();

  private static parseCHHostPort(): { host: string; port: string } {
    const raw = process.env.CLICKHOUSE_HOST ?? "localhost";
    try {
      const url = new URL(raw.includes("://") ? raw : `http://${raw}`);
      return {
        host: url.hostname,
        port: url.port || process.env.CLICKHOUSE_PORT || "8123",
      };
    } catch {
      // Not a valid URL — use as bare hostname
      return {
        host: raw.replace(/^https?:\/\//i, "").split(":")[0],
        port: process.env.CLICKHOUSE_PORT ?? "8123",
      };
    }
  }

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
          filters     String DEFAULT '[]',
          isActive    UInt8  DEFAULT 1,
          seq         UInt64,
          createdAt   DateTime DEFAULT now(),
          updatedAt   String DEFAULT ''
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);
    } catch (e) {
      this.logger.error("Failed to ensure excel_report_templates table:", e);
    }
    // Migrate: add filters column if it doesn't exist (for tables created before this column)
    try {
      await this.clickhouse.exec(
        `ALTER TABLE excel_report_templates ADD COLUMN IF NOT EXISTS filters String DEFAULT '[]'`,
      );
    } catch {
      // ignore — column already exists or unsupported
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
           argMax(filters, seq)     AS filters,
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
         argMax(filters, seq)     AS filters,
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
        filters: dto.filters ?? "[]",
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
        filters: dto.filters ?? existing.filters,
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
        filters: existing.filters,
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
      `ALTER TABLE excel_report_templates DELETE WHERE id = {id:String}`,
      { id },
    );
  }

  // ── User: list active templates ────────────────────────────────────────────

  async getActiveTemplates(): Promise<
    (Omit<ReportTemplate, "pythonCode" | "isActive"> & { isSqlMode: boolean })[]
  > {
    const all = await this.getLatestTemplates(true);
    return all.map(({ pythonCode, isActive: _a, ...rest }) => ({
      ...rest,
      isSqlMode: pythonCode.startsWith("# __SQL_MODE__"),
    }));
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

    const sql = ExcelReportService.extractSqlFromPythonCode(template.pythonCode);
    if (!sql) {
      throw new BadRequestException(
        "Зөвхөн SQL горимын тайлан дэмжигдэнэ. Admin хэсгээс тайланг шинэчилнэ үү.",
      );
    }
    return this.generateExcelFromSql(
      sql,
      dto.filters ?? {},
      dto.startDate ?? "",
      dto.endDate ?? dto.startDate ?? "",
      template.name,
    );
  }

  // ── SQL-mode → Excel directly in Node.js (no Python, no temp file) ──
  private async generateExcelFromSql(
    sql: string,
    filterVals: Record<string, string>,
    startDate: string,
    endDate: string,
    sheetName = "Тайлан",
  ): Promise<Buffer> {
    // Resolve {IF}...{/IF} blocks and placeholders
    let resolved = sql.replace(
      /\{IF (\w+)\}([\s\S]*?)\{\/IF\}/g,
      (_, k, content) => (filterVals[k] ? content : ""),
    );
    resolved = resolved.replace(/\{start_date\}/g, startDate).replace(/\{end_date\}/g, endDate);
    for (const [k, v] of Object.entries(filterVals)) {
      resolved = resolved.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }

    const { host, port } = ExcelReportService.parseCHHostPort();
    const query = resolved.trim() + " FORMAT TSVWithNames";
    const password = process.env.CLICKHOUSE_PASSWORD ?? "";
    const user = process.env.CLICKHOUSE_USER ?? "default";
    const database = process.env.CLICKHOUSE_DATABASE ?? "audit_db";
    const urlPath = `/?user=${encodeURIComponent(user)}&password=${encodeURIComponent(password)}&database=${encodeURIComponent(database)}`;

    // Stream ClickHouse TSV response → ExcelJS streaming workbook → Buffer
    const buf = await new Promise<Buffer>((resolve, reject) => {
      const req = http.request(
        { hostname: host, port: Number(port) || 8123, path: urlPath, method: "POST" },
        (res) => {
          if (res.statusCode !== 200) {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () =>
              reject(new InternalServerErrorException(
                "ClickHouse алдаа: " + Buffer.concat(chunks).toString("utf-8").slice(0, 300),
              )),
            );
            return;
          }

          const outputStream = new PassThrough();
          const chunks: Buffer[] = [];
          outputStream.on("data", (c: Buffer) => chunks.push(c));
          outputStream.on("end", () => resolve(Buffer.concat(chunks)));
          outputStream.on("error", reject);

          const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: outputStream, useSharedStrings: false });
          const ws = wb.addWorksheet(sheetName);

          let headerParsed = false;
          let remainder = "";

          res.on("data", (chunk: Buffer) => {
            const text = remainder + chunk.toString("utf-8");
            const lines = text.split("\n");
            remainder = lines.pop() ?? "";

            for (const line of lines) {
              if (!line) continue;
              const cells = line.split("\t");
              if (!headerParsed) {
                ws.addRow(cells).commit();
                headerParsed = true;
              } else {
                ws.addRow(cells.map((v) => {
                  const n = Number(v);
                  return v !== "" && !isNaN(n) ? n : v;
                })).commit();
              }
            }
          });

          res.on("end", async () => {
            if (remainder) {
              const cells = remainder.split("\t");
              if (cells.some((c) => c !== "")) {
                ws.addRow(cells.map((v) => { const n = Number(v); return v !== "" && !isNaN(n) ? n : v; })).commit();
              }
            }
            await ws.commit();
            await wb.commit();
          });

          res.on("error", reject);
        },
      );
      req.on("error", (e: Error) =>
        reject(new InternalServerErrorException("ClickHouse холболт алдаа: " + e.message)),
      );
      req.write(Buffer.from(query, "utf-8"));
      req.end();
    });

    return buf;
  }

  // ── Async job API ──────────────────────────────────────────────────────────

  /** Start report generation in background, return jobId immediately */
  async runReportAsync(dto: RunReportDto): Promise<string> {
    const template = await this.getTemplateById(dto.templateId);
    if (!template.isActive) {
      throw new BadRequestException("Энэ тайлан идэвхгүй байна");
    }
    if (template.dateMode === "range" && (!dto.startDate || !dto.endDate)) {
      throw new BadRequestException("Эхлэх болон дуусах огноо шаардлагатай");
    }
    if (template.dateMode === "single" && !dto.startDate) {
      throw new BadRequestException("Огноо шаардлагатай");
    }

    const jobId = randomUUID();
    const job: ReportJob = {
      id: jobId,
      status: "pending",
      startedAt: Date.now(),
    };
    this.jobs.set(jobId, job);

    // Fire-and-forget — runs in background
    this.processJob(jobId, dto, template).catch(() => {});

    // Cleanup old finished jobs after 30 min
    setTimeout(() => this.jobs.delete(jobId), 30 * 60 * 1000);

    return jobId;
  }

  private async processJob(
    jobId: string,
    dto: RunReportDto,
    template: ReportTemplate,
  ): Promise<void> {
    const job = this.jobs.get(jobId)!;
    job.status = "running";

    try {
      const date = new Date().toISOString().slice(0, 10);
      job.fileName = `${template.name}_${date}.xlsx`;

      const sql = ExcelReportService.extractSqlFromPythonCode(template.pythonCode);
      if (!sql) {
        throw new BadRequestException(
          "Зөвхөн SQL горимын тайлан дэмжигдэнэ. Admin хэсгээс тайланг шинэчилнэ үү.",
        );
      }
      job.buffer = await this.generateExcelFromSql(
        sql,
        dto.filters ?? {},
        dto.startDate ?? "",
        dto.endDate ?? dto.startDate ?? "",
        template.name,
      );
      job.status = "done";
      job.finishedAt = Date.now();
    } catch (err: any) {
      job.status = "error";
      job.finishedAt = Date.now();
      job.error = err?.message ?? "Тайлан үүсгэхэд тодорхойгүй алдаа гарлаа";
      this.logger.error(`Job ${jobId} failed: ${job.error}`);
    }
  }

  getJobStatus(jobId: string): {
    status: JobStatus;
    elapsedMs: number;
    error?: string;
    fileName?: string;
  } {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException("Ажил олдсонгүй");
    return {
      status: job.status,
      elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
      error: job.error,
      fileName: job.fileName,
    };
  }

  getJobFile(jobId: string): { buffer: Buffer; fileName: string } {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException("Ажил олдсонгүй");
    if (job.status !== "done" || !job.buffer) {
      throw new BadRequestException("Тайлан бэлэн болоогүй байна");
    }
    return { buffer: job.buffer, fileName: job.fileName! };
  }

  // ── Preview: run SQL-mode report against ClickHouse directly, return JSON ─

  async previewReport(dto: RunReportDto): Promise<{ columns: string[]; rows: any[][] }> {
    const template = await this.getTemplateById(dto.templateId);
    const sql = ExcelReportService.extractSqlFromPythonCode(template.pythonCode);
    if (!sql) {
      throw new BadRequestException(
        "Энэ тайлан preview дэмжихгүй (SQL горим биш). Зөвхөн SQL горимын тайлан урьдчилан харагдана.",
      );
    }

    // Substitute date placeholders and filter values
    const start = dto.startDate ?? "";
    const end = dto.endDate ?? dto.startDate ?? "";
    const filterVals: Record<string, string> = dto.filters ?? {};
    let resolved = sql.replace(
      /\{IF (\w+)\}([\s\S]*?)\{\/IF\}/g,
      (_, name, content) => (filterVals[name] ? content : ""),
    );
    resolved = resolved.replace(/\{start_date\}/g, start).replace(/\{end_date\}/g, end);
    for (const [k, v] of Object.entries(filterVals)) {
      resolved = resolved.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }

    const previewSql = `SELECT * FROM (\n${resolved}\n) LIMIT 50 FORMAT TSVWithNames`;

    const { host, port } = ExcelReportService.parseCHHostPort();
    const urlPath = `/?user=${encodeURIComponent(process.env.CLICKHOUSE_USER ?? "default")}&password=${encodeURIComponent(process.env.CLICKHOUSE_PASSWORD ?? "")}&database=${encodeURIComponent(process.env.CLICKHOUSE_DATABASE ?? "audit_db")}`;

    const tsv = await new Promise<string>((resolve, reject) => {
      const body = Buffer.from(previewSql, "utf-8");
      const req = http.request(
        { hostname: host, port: Number(port) || 8123, path: urlPath, method: "POST" },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf-8");
            if ((res.statusCode ?? 0) !== 200) {
              reject(new InternalServerErrorException("ClickHouse алдаа: " + text.slice(0, 300)));
            } else {
              resolve(text);
            }
          });
        },
      );
      req.on("error", (e: Error) => reject(new InternalServerErrorException("ClickHouse холболт алдаа: " + e.message)));
      req.write(body);
      req.end();
    });

    // Parse TSVWithNames: first line = headers, remaining = data rows
    const lines = tsv.split("\n");
    const columns = lines[0] ? lines[0].split("\t") : [];
    const rows: any[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      rows.push(line.split("\t"));
    }

    return { columns, rows };
  }

  /** Extract SQL string from SQL-mode pythonCode, or null if not SQL mode. */
  private static extractSqlFromPythonCode(pythonCode: string): string | null {
    if (!pythonCode.startsWith("# __SQL_MODE__")) return null;
    const m = pythonCode.match(/^SQL = r'''\n([\s\S]*?)\n'''\.strip\(\)/m);
    if (m) return m[1].replace(/''\\'''/g, "'''");
    return null;
  }

  // ── SQL-mode → CSV directly from ClickHouse (no format conversion) ────────

  /** Stream ClickHouse CSVWithNames bytes directly — zero ExcelJS overhead. */
  private async generateCsvFromSql(
    sql: string,
    filterVals: Record<string, string>,
    startDate: string,
    endDate: string,
  ): Promise<Buffer> {
    let resolved = sql.replace(
      /\{IF (\w+)\}([\s\S]*?)\{\/IF\}/g,
      (_, k, content) => (filterVals[k] ? content : ""),
    );
    resolved = resolved.replace(/\{start_date\}/g, startDate).replace(/\{end_date\}/g, endDate);
    for (const [k, v] of Object.entries(filterVals)) {
      resolved = resolved.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }

    const { host, port } = ExcelReportService.parseCHHostPort();
    const query = resolved.trim() + " FORMAT CSVWithNames";
    const urlPath = `/?user=${encodeURIComponent(process.env.CLICKHOUSE_USER ?? "default")}&password=${encodeURIComponent(process.env.CLICKHOUSE_PASSWORD ?? "")}&database=${encodeURIComponent(process.env.CLICKHOUSE_DATABASE ?? "audit_db")}`;

    return new Promise<Buffer>((resolve, reject) => {
      const req = http.request(
        { hostname: host, port: Number(port) || 8123, path: urlPath, method: "POST" },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const buf = Buffer.concat(chunks);
            if ((res.statusCode ?? 0) !== 200) {
              reject(new InternalServerErrorException(
                "ClickHouse алдаа: " + buf.toString("utf-8").slice(0, 300),
              ));
            } else {
              // UTF-8 BOM — Excel-д Кирилл тэмдэгт зөв харагдана
              resolve(Buffer.concat([Buffer.from("\xEF\xBB\xBF"), buf]));
            }
          });
          res.on("error", reject);
        },
      );
      req.on("error", (e: Error) =>
        reject(new InternalServerErrorException("ClickHouse холболт алдаа: " + e.message)),
      );
      req.write(Buffer.from(query, "utf-8"));
      req.end();
    });
  }

  async runReportCsv(dto: RunReportDto): Promise<{ csv: Buffer; fileName: string }> {
    const template = await this.getTemplateById(dto.templateId);
    if (!template.isActive) throw new BadRequestException("Энэ тайлан идэвхгүй байна");
    if (template.dateMode === "range" && (!dto.startDate || !dto.endDate)) {
      throw new BadRequestException("Эхлэх болон дуусах огноо шаардлагатай");
    }
    if (template.dateMode === "single" && !dto.startDate) {
      throw new BadRequestException("Огноо шаардлагатай");
    }
    const sql = ExcelReportService.extractSqlFromPythonCode(template.pythonCode);
    if (!sql) throw new BadRequestException("Зөвхөн SQL горимын тайлан дэмжигдэнэ.");
    const csv = await this.generateCsvFromSql(
      sql,
      dto.filters ?? {},
      dto.startDate ?? "",
      dto.endDate ?? dto.startDate ?? "",
    );
    const date = new Date().toISOString().slice(0, 10);
    return { csv, fileName: `${template.name}_${date}.csv` };
  }

  // ── Direct SQL → Excel ────────────────────────────────────────────────────

  async queryToExcel(dto: QueryToExcelDto): Promise<Buffer> {
    // Validate SELECT-only before executing
    const cleaned = dto.sql
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/--[^\n]*/g, "")
      .trim();
    if (!/^\s*SELECT\b/i.test(cleaned)) {
      throw new BadRequestException(
        "Зөвхөн SELECT query зөвшөөрөгдөнө. INSERT/UPDATE/DELETE/DROP зэрэг үйлдэл хориглоно.",
      );
    }
    return this.generateExcelFromSql(dto.sql, {}, "", "", "Result");
  }
}

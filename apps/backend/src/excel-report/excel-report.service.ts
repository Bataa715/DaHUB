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

  // ── Security preamble injected before every Python execution ──────────────
  // Wraps urllib.request.urlopen so that every ClickHouse HTTP call is
  // validated: only SELECT queries are permitted. Any INSERT/UPDATE/DELETE/
  // ALTER/DROP/CREATE/TRUNCATE attempt raises PermissionError at runtime.
  private static readonly PYTHON_SECURITY_PREAMBLE =
    "# === SECURITY PREAMBLE (auto-injected) ===\n" +
    "import urllib.request as _urllib_req\n" +
    "import re as _re\n" +
    "from urllib.parse import urlparse as _urlparse, parse_qs as _parse_qs, unquote_plus as _unquote_plus\n" +
    "\n" +
    "_orig_urlopen = _urllib_req.urlopen\n" +
    "\n" +
    "def _check_select_only(sql, source):\n" +
    "    cleaned = _re.sub(r'/\\*.*?\\*/', '', sql, flags=_re.DOTALL)\n" +
    "    cleaned = _re.sub(r'--[^\\n]*', '', cleaned).strip()\n" +
    "    if not _re.match(r'(?i)^\\s*SELECT\\b', cleaned):\n" +
    "        raise PermissionError('[SECURITY] Зөвхөн SELECT query зөвшөөрөгдөнө (' + source + '). Олдсон: ' + sql[:120])\n" +
    "\n" +
    "def _safe_urlopen(url, data=None, **kwargs):\n" +
    "    url_str = url.full_url if hasattr(url, 'full_url') else str(url)\n" +
    "    body = (url.data if hasattr(url, 'data') else None) or data\n" +
    "    parsed = _urlparse(url_str)\n" +
    "    params = _parse_qs(parsed.query)\n" +
    "    if 'query' in params:\n" +
    "        _check_select_only(_unquote_plus(params['query'][0]), 'URL param')\n" +
    "    if body is not None:\n" +
    "        try:\n" +
    "            raw = body.decode('utf-8') if isinstance(body, (bytes, bytearray)) else str(body)\n" +
    "        except Exception:\n" +
    "            raw = repr(body)\n" +
    "        sql = _unquote_plus(raw[6:].split('&')[0]) if raw.startswith('query=') else raw\n" +
    "        _check_select_only(sql, 'POST body')\n" +
    "    return _orig_urlopen(url, data=data, **kwargs)\n" +
    "\n" +
    "_urllib_req.urlopen = _safe_urlopen\n" +
    "# === END SECURITY PREAMBLE ===\n\n";

  // ── Forbidden patterns for static analysis at save time ───────────────────
  private static readonly FORBIDDEN_PATTERNS: Array<{
    re: RegExp;
    label: string;
  }> = [
    {
      re: /\bimport\s+subprocess\b|\bfrom\s+subprocess\b/,
      label: "subprocess",
    },
    { re: /\bimport\s+socket\b|\bfrom\s+socket\b/, label: "socket" },
    { re: /\bimport\s+ctypes\b|\bfrom\s+ctypes\b/, label: "ctypes" },
    {
      re: /\bimport\s+multiprocessing\b|\bfrom\s+multiprocessing\b/,
      label: "multiprocessing",
    },
    { re: /\bimport\s+pickle\b|\bfrom\s+pickle\b/, label: "pickle" },
    { re: /\bimport\s+shutil\b|\bfrom\s+shutil\b/, label: "shutil" },
    { re: /\beval\s*\(/, label: "eval()" },
    { re: /\bexec\s*\(/, label: "exec()" },
    { re: /\bcompile\s*\(/, label: "compile()" },
    { re: /\b__import__\s*\(/, label: "__import__()" },
    { re: /\bos\.system\s*\(/, label: "os.system()" },
    { re: /\bos\.popen\s*\(/, label: "os.popen()" },
    { re: /\bos\.exec[a-z]+\s*\(/, label: "os.exec*()" },
    { re: /\bos\.fork\s*\(/, label: "os.fork()" },
    { re: /\bos\.spawn[a-z]+\s*\(/, label: "os.spawn*()" },
    {
      re: /\bos\.remove\s*\(|\bos\.unlink\s*\(|\bos\.rmdir\s*\(/,
      label: "os file deletion",
    },
    {
      re: /open\s*\([^)]*['"]\s*(?:w|a|wb|ab|w\+|a\+)\s*['"]/,
      label: "open() in write mode",
    },
  ];

  private validatePythonCode(code: string): void {
    for (const { re, label } of ExcelReportService.FORBIDDEN_PATTERNS) {
      if (re.test(code)) {
        throw new BadRequestException(
          `Python код аюултай үйлдэл агуулж байна: "${label}". Зөвхөн SELECT query-тэй ClickHouse уншилт зөвшөөрөгдөнө.`,
        );
      }
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
    this.validatePythonCode(dto.pythonCode);
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
    if (dto.pythonCode !== undefined) {
      this.validatePythonCode(dto.pythonCode);
    }
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
      `ALTER TABLE excel_report_templates DELETE WHERE id = {id:String}`,
      { id },
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
      const securedCode =
        ExcelReportService.PYTHON_SECURITY_PREAMBLE + template.pythonCode;
      fs.writeFileSync(scriptPath, securedCode, "utf8");

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
        timeout: 600000, // 10 min max for large datasets
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

    const tmpDir = os.tmpdir();
    const scriptPath = path.join(tmpDir, `excel_job_${jobId}.py`);
    const outputPath = path.join(tmpDir, `excel_job_${jobId}.xlsx`);

    try {
      const securedCode =
        ExcelReportService.PYTHON_SECURITY_PREAMBLE + template.pythonCode;
      fs.writeFileSync(scriptPath, securedCode, "utf8");

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
          "Python скрипт Excel файл үүсгээгүй байна.",
        );
      }

      job.buffer = fs.readFileSync(outputPath);
      const date = new Date().toISOString().slice(0, 10);
      job.fileName = `${template.name}_${date}.xlsx`;
      job.status = "done";
      job.finishedAt = Date.now();
    } catch (err: any) {
      job.status = "error";
      job.finishedAt = Date.now();
      job.error = err?.message ?? "Тайлан үүсгэхэд тодорхойгүй алдаа гарлаа";
      this.logger.error(`Job ${jobId} failed: ${job.error}`);
    } finally {
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
      try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}
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
}

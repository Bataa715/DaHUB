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

  // ── DataFrame mode preamble: injected before user code when # __DF_MODE__ is detected ─
  // Provides: ch_query(), START_DATE, END_DATE, OUTPUT_FILE, CLICKHOUSE_* env vars
  private static readonly PYTHON_DF_PREAMBLE = [
    "# === DATAFRAME PREAMBLE (auto-injected) ===",
    "import sys, os, json, warnings",
    "sys.stdout.reconfigure(encoding='utf-8', errors='replace')",
    "sys.stderr.reconfigure(encoding='utf-8', errors='replace')",
    "import pandas as pd",
    "import urllib.request",
    "from urllib.parse import urlencode",
    "warnings.filterwarnings('ignore')",
    "",
    "CLICKHOUSE_HOST = os.environ.get('CLICKHOUSE_HOST', 'localhost')",
    "CLICKHOUSE_PORT = os.environ.get('CLICKHOUSE_PORT', '8123')",
    "CLICKHOUSE_USER = os.environ.get('CLICKHOUSE_USER', 'default')",
    "CLICKHOUSE_PASSWORD = os.environ.get('CLICKHOUSE_PASSWORD', '')",
    "CLICKHOUSE_DATABASE = os.environ.get('CLICKHOUSE_DATABASE', 'audit_db')",
    "START_DATE = os.environ.get('START_DATE', '')",
    "END_DATE   = os.environ.get('END_DATE', '')",
    "OUTPUT_FILE = os.environ['OUTPUT_FILE']",
    "",
    "def ch_query(sql, **kw):",
    "    \"\"\"ClickHouse-аас DataFrame буцаана. {start_date}/{end_date} автоматаар орлуулна.\"\"\"",
    "    sql = sql.replace('{start_date}', START_DATE).replace('{end_date}', END_DATE)",
    "    for k, v in kw.items():",
    "        sql = sql.replace('{' + k + '}', str(v))",
    "    params = urlencode({'user': CLICKHOUSE_USER, 'password': CLICKHOUSE_PASSWORD,",
    "                        'database': CLICKHOUSE_DATABASE, 'default_format': 'JSONCompact'})",
    "    url = 'http://' + CLICKHOUSE_HOST + ':' + CLICKHOUSE_PORT + '/?' + params",
    "    req = urllib.request.Request(url, data=sql.encode('utf-8'), method='POST')",
    "    with urllib.request.urlopen(req) as resp:",
    "        result = json.loads(resp.read().decode('utf-8'))",
    "    cols = [m['name'] for m in result.get('meta', [])]",
    "    return pd.DataFrame(result.get('data', []), columns=cols)",
    "",
    "# === END DATAFRAME PREAMBLE ===",
    "",
  ].join("\n");

  // ── DataFrame mode postamble: auto-exports df (or sheets dict) to styled Excel ──
  private static readonly PYTHON_DF_POSTAMBLE = [
    "",
    "# === DATAFRAME POSTAMBLE (auto-injected) ===",
    "_lc = vars()",
    "if 'sheets' in _lc and isinstance(_lc['sheets'], dict):",
    "    _sheets = _lc['sheets']",
    "elif 'df' in _lc and hasattr(_lc['df'], 'to_excel'):",
    "    _sheets = {'Тайлан': _lc['df']}",
    "else:",
    "    raise RuntimeError(",
    "        \"'df' (pandas.DataFrame) эсвэл 'sheets' (dict) хувьсагч тодорхойлогдоогүй байна.\\n\"",
    "        \"Жишээ: df = ch_query(sql)\"",
    "    )",
    "import openpyxl",
    "from openpyxl.styles import Font, PatternFill, Alignment, Border, Side",
    "from openpyxl.utils import get_column_letter",
    "_first = True",
    "_wb = None",
    "for _sn, _sdf in _sheets.items():",
    "    if _first:",
    "        _sdf.to_excel(OUTPUT_FILE, sheet_name=_sn, index=False, engine='openpyxl')",
    "        _wb = openpyxl.load_workbook(OUTPUT_FILE)",
    "        _first = False",
    "    else:",
    "        _ws2 = _wb.create_sheet(title=_sn)",
    "        _ws2.append(list(_sdf.columns))",
    "        for _r in _sdf.itertuples(index=False, name=None):",
    "            _ws2.append(list(_r))",
    "_hfill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')",
    "_hfont = Font(color='FFFFFF', bold=True)",
    "_thin  = Side(border_style='thin', color='8EA9C1')",
    "_efill = PatternFill(start_color='D6E4F0', end_color='D6E4F0', fill_type='solid')",
    "_dside = Side(border_style='thin', color='D0D0D0')",
    "for _ws in _wb.worksheets:",
    "    for _c in _ws[1]:",
    "        _c.fill = _hfill; _c.font = _hfont",
    "        _c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)",
    "        _c.border = Border(bottom=_thin)",
    "    for _ri, _row in enumerate(_ws.iter_rows(min_row=2), 2):",
    "        for _c in _row:",
    "            if _ri % 2 == 0: _c.fill = _efill",
    "            _c.border = Border(bottom=_dside)",
    "    for _col in _ws.columns:",
    "        _ml = 0",
    "        for _c in list(_col)[:101]:",
    "            if _c.value is not None: _ml = max(_ml, len(str(_c.value)))",
    "        _ws.column_dimensions[get_column_letter(list(_col)[0].column)].width = min(_ml + 2, 50)",
    "    _ws.row_dimensions[1].height = 30",
    "    _ws.freeze_panes = 'A2'",
    "_wb.save(OUTPUT_FILE)",
    "_tot = sum(len(d) for d in _sheets.values())",
    "print('Done: ' + str(_tot) + ' rows | ' + str(len(_sheets)) + ' sheet(s)')",
    "# === END DATAFRAME POSTAMBLE ===",
  ].join("\n");

  // ── Fixed Python template for direct SQL → Excel (server-controlled, no user code) ──
  private static readonly SQL_TO_EXCEL_PYTHON = [
    "import os, json, urllib.request, openpyxl",
    "from openpyxl.styles import Font, PatternFill, Alignment, Border, Side",
    "from openpyxl.utils import get_column_letter",
    "from urllib.parse import urlencode",
    "",
    "CH_HOST = os.environ.get('CLICKHOUSE_HOST', 'localhost')",
    "CH_PORT = os.environ.get('CLICKHOUSE_PORT', '8123')",
    "CH_USER = os.environ.get('CLICKHOUSE_USER', 'default')",
    "CH_PASS = os.environ.get('CLICKHOUSE_PASSWORD', '')",
    "CH_DB   = os.environ.get('CLICKHOUSE_DATABASE', 'audit_db')",
    "SQL     = os.environ['QUERY_SQL']",
    "OUTPUT  = os.environ['OUTPUT_FILE']",
    "",
    "params = urlencode({'user': CH_USER, 'password': CH_PASS, 'database': CH_DB, 'default_format': 'JSONCompact'})",
    "url = 'http://' + CH_HOST + ':' + CH_PORT + '/?' + params",
    "req = urllib.request.Request(url, data=SQL.encode('utf-8'), method='POST')",
    "with urllib.request.urlopen(req) as resp:",
    "    result = json.loads(resp.read().decode('utf-8'))",
    "",
    "headers = [col['name'] for col in result.get('meta', [])]",
    "rows = result.get('data', [])",
    "",
    "wb = openpyxl.Workbook()",
    "ws = wb.active",
    "ws.title = 'Result'",
    "",
    "header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')",
    "header_font = Font(color='FFFFFF', bold=True)",
    "thin = Side(border_style='thin', color='8EA9C1')",
    "for ci, h in enumerate(headers, 1):",
    "    cell = ws.cell(row=1, column=ci, value=h)",
    "    cell.fill = header_fill",
    "    cell.font = header_font",
    "    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)",
    "    cell.border = Border(bottom=thin)",
    "",
    "even_fill = PatternFill(start_color='D6E4F0', end_color='D6E4F0', fill_type='solid')",
    "data_side = Side(border_style='thin', color='D0D0D0')",
    "for ri, row in enumerate(rows, 2):",
    "    for ci, val in enumerate(row, 1):",
    "        cell = ws.cell(row=ri, column=ci, value=val)",
    "        if ri % 2 == 0:",
    "            cell.fill = even_fill",
    "        cell.border = Border(bottom=data_side)",
    "",
    "for ci in range(1, len(headers) + 1):",
    "    max_len = len(str(headers[ci - 1]))",
    "    for ri in range(2, min(len(rows) + 2, 102)):",
    "        v = ws.cell(row=ri, column=ci).value",
    "        if v is not None:",
    "            max_len = max(max_len, len(str(v)))",
    "    ws.column_dimensions[get_column_letter(ci)].width = min(max_len + 2, 50)",
    "",
    "ws.row_dimensions[1].height = 30",
    "ws.freeze_panes = 'A2'",
    "wb.save(OUTPUT)",
    "print('Done: ' + str(len(rows)) + ' rows, ' + str(len(headers)) + ' columns')",
  ].join("\n");

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

  /**
   * Parse CLICKHOUSE_HOST which may be a full URL like "http://localhost:8123"
   * or a bare hostname like "localhost". Returns clean { host, port } for Python.
   */
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

  private buildPythonEnv(
    extra: Record<string, string> = {},
  ): Record<string, string> {
    const { host, port } = ExcelReportService.parseCHHostPort();
    return {
      ...process.env,
      CLICKHOUSE_HOST: host,
      CLICKHOUSE_PORT: port,
      CLICKHOUSE_USER: process.env.CLICKHOUSE_USER ?? "default",
      CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD ?? "",
      CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE ?? "audit_db",
      ...extra,
    };
  }

  // ── Assemble executable script for a template ─────────────────────────────
  private buildScript(pythonCode: string): string {
    if (pythonCode.startsWith("# __DF_MODE__")) {
      // Strip the marker line, wrap user code with preamble + postamble
      const userCode = pythonCode.replace(/^#\s*__DF_MODE__[^\n]*\n?/, "");
      return (
        ExcelReportService.PYTHON_SECURITY_PREAMBLE +
        ExcelReportService.PYTHON_DF_PREAMBLE +
        userCode +
        "\n" +
        ExcelReportService.PYTHON_DF_POSTAMBLE
      );
    }
    // Legacy full-Python mode: security preamble only
    return ExcelReportService.PYTHON_SECURITY_PREAMBLE + pythonCode;
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

    // Write python code to a temp file
    const tmpDir = os.tmpdir();
    const scriptPath = path.join(tmpDir, `excel_report_${randomUUID()}.py`);
    const outputPath = path.join(tmpDir, `excel_report_${randomUUID()}.xlsx`);

    try {
      const securedCode = this.buildScript(template.pythonCode);
      fs.writeFileSync(scriptPath, securedCode, "utf8");

      // Build env — pass ClickHouse connection + date params
      const env: Record<string, string> = this.buildPythonEnv({
        OUTPUT_FILE: outputPath,
        START_DATE: dto.startDate ?? "",
        END_DATE: dto.endDate ?? dto.startDate ?? "",
        REPORT_NAME: template.name,
      });

      const stdout1 = await this.executePython(scriptPath, env);

      if (!fs.existsSync(outputPath)) {
        throw new InternalServerErrorException(
          `Python скрипт Excel файл үүсгээгүй байна. OUTPUT_FILE замд файл хадгалах шаардлагтай.${stdout1.trim() ? "\nStdout: " + stdout1.trim().slice(0, 400) : ""}`,
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
  ): Promise<string> {
    // Try 'python', then 'py' (Windows Store alias), then 'python3' (Linux/Mac)
    const candidates =
      process.platform === "win32"
        ? ["python", "py", "python3"]
        : ["python3", "python"];

    const tryNext = (
      remaining: string[],
      resolve: (out: string) => void,
      reject: (e: Error) => void,
    ) => {
      if (remaining.length === 0) {
        reject(
          new InternalServerErrorException(
            "Python олдсонгүй. 'python', 'py', эсвэл 'python3' командын аль нэг нь PATH-д байх ёстой.",
          ) as unknown as Error,
        );
        return;
      }
      const [cmd, ...rest] = remaining;
      const proc = spawn(cmd, [scriptPath], {
        env,
        timeout: 600000,
      });

      let stderr = "";
      let stdout = "";
      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.on("close", (code: number) => {
        if (code !== 0) {
          // Windows App Execution Alias for Python exits with 9009 and prints
          // "Python was not found; run without arguments to install from the
          // Microsoft Store …" — treat this as "not found" and try next.
          const isStoreAlias =
            code === 9009 ||
            stderr.includes("Microsoft Store") ||
            stderr.includes("was not found");
          if (isStoreAlias && rest.length > 0) {
            tryNext(rest, resolve, reject);
          } else {
            const detail = [stderr, stdout]
              .map((s) => s.trim())
              .filter(Boolean)
              .join("\n")
              .slice(0, 800);
            reject(
              new InternalServerErrorException(
                `Python скрипт алдаатай дуусгав (code ${code}):\n${detail}`,
              ) as unknown as Error,
            );
          }
        } else {
          resolve(stdout);
        }
      });

      proc.on("error", (err: Error) => {
        // ENOENT = command not found → try next candidate
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          tryNext(rest, resolve, reject);
        } else {
          reject(
            new InternalServerErrorException(
              `Python ажиллуулах боломжгүй (${cmd}): ${err.message}`,
            ) as unknown as Error,
          );
        }
      });
    };

    return new Promise((resolve, reject) => {
      tryNext(candidates, resolve, reject);
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
      const securedCode = this.buildScript(template.pythonCode);
      fs.writeFileSync(scriptPath, securedCode, "utf8");

      const env: Record<string, string> = this.buildPythonEnv({
        OUTPUT_FILE: outputPath,
        START_DATE: dto.startDate ?? "",
        END_DATE: dto.endDate ?? dto.startDate ?? "",
        REPORT_NAME: template.name,
      });

      const jobStdout = await this.executePython(scriptPath, env);

      if (!fs.existsSync(outputPath)) {
        throw new InternalServerErrorException(
          `Python скрипт Excel файл үүсгээгүй байна.${jobStdout.trim() ? "\nStdout: " + jobStdout.trim().slice(0, 400) : ""}`,
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

  // ── Preview: run SQL-mode report against ClickHouse directly, return JSON ─

  async previewReport(dto: RunReportDto): Promise<{ columns: string[]; rows: any[][] }> {
    const template = await this.getTemplateById(dto.templateId);
    const sql = ExcelReportService.extractSqlFromPythonCode(template.pythonCode);
    if (!sql) {
      throw new BadRequestException(
        "Энэ тайлан preview дэмжихгүй (SQL горим биш). Зөвхөн SQL горимын тайлан урьдчилан харагдана.",
      );
    }

    // Substitute date placeholders
    const start = dto.startDate ?? "";
    const end = dto.endDate ?? dto.startDate ?? "";
    const resolvedSql = sql
      .replace(/\{start_date\}/g, start)
      .replace(/\{end_date\}/g, end);

    // Inject LIMIT 100 as outer query for safety
    const previewSql = `SELECT * FROM (\n${resolvedSql}\n) LIMIT 100`;

    // Run directly via ClickHouse HTTP (JSONCompact → meta + data)
    const { host, port } = ExcelReportService.parseCHHostPort();
    const url = `http://${host}:${port}/?user=${encodeURIComponent(process.env.CLICKHOUSE_USER ?? "default")}&password=${encodeURIComponent(process.env.CLICKHOUSE_PASSWORD ?? "")}&default_format=JSONCompact`;

    const result = await new Promise<{ meta: {name:string}[]; data: any[][] }>(
      (resolve, reject) => {
        const http = require("http") as typeof import("http");
        const body = Buffer.from(previewSql, "utf-8");
        const parsed = new URL(url);
        const req = http.request(
          { hostname: parsed.hostname, port: Number(parsed.port) || 8123, path: parsed.pathname + parsed.search, method: "POST" },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => {
              const text = Buffer.concat(chunks).toString("utf-8");
              try {
                resolve(JSON.parse(text));
              } catch {
                reject(new InternalServerErrorException("ClickHouse хариу буруу: " + text.slice(0, 200)));
              }
            });
          },
        );
        req.on("error", (e: Error) => reject(new InternalServerErrorException("ClickHouse холболт алдаа: " + e.message)));
        req.write(body);
        req.end();
      },
    );

    if (!result?.meta) {
      throw new InternalServerErrorException("ClickHouse meta мэдээлэл ирсэнгүй");
    }

    return {
      columns: result.meta.map((m) => m.name),
      rows: result.data ?? [],
    };
  }

  /** Extract SQL string from SQL-mode pythonCode, or null if not SQL mode. */
  private static extractSqlFromPythonCode(pythonCode: string): string | null {
    if (!pythonCode.startsWith("# __SQL_MODE__")) return null;
    const m = pythonCode.match(/^SQL = r'''\n([\s\S]*?)\n'''\.strip\(\)/m);
    if (m) return m[1].replace(/''\\'''/g, "'''");
    return null;
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

    const tmpDir = os.tmpdir();
    const scriptPath = path.join(tmpDir, `sql_excel_${randomUUID()}.py`);
    const outputPath = path.join(tmpDir, `sql_excel_${randomUUID()}.xlsx`);

    try {
      fs.writeFileSync(scriptPath, ExcelReportService.SQL_TO_EXCEL_PYTHON, "utf8");

      const env: Record<string, string> = this.buildPythonEnv({
        QUERY_SQL: dto.sql,
        OUTPUT_FILE: outputPath,
      });

      const sqlStdout = await this.executePython(scriptPath, env);

      if (!fs.existsSync(outputPath)) {
        throw new InternalServerErrorException(
          `Python скрипт Excel файл үүсгээгүй байна.${sqlStdout.trim() ? "\nStdout: " + sqlStdout.trim().slice(0, 400) : ""}`,
        );
      }

      return fs.readFileSync(outputPath);
    } finally {
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
      try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}
    }
  }
}

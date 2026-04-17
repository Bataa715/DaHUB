import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  OnModuleInit,
} from "@nestjs/common";
import * as http from "http";
import {
  randomUUID,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import {
  CreatePythonToolDto,
  UpdatePythonToolDto,
  RunToolDto,
} from "./dto/python-api.dto";

export interface PythonApiTool {
  id: string;
  name: string;
  apiPath: string;
  description: string;
  pythonCode: string;
  connectionType: "clickhouse" | "oracle" | "mssql" | "none";
  connectionConfig: string; // JSON string
  outputFormat: "excel" | "csv";
  dateMode: "none" | "single" | "range";
  color: string;
  filters: string; // JSON string of FilterDef[]
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PythonApiService implements OnModuleInit {
  private readonly logger = new Logger(PythonApiService.name);

  private readonly pythonServiceUrl =
    process.env.PYTHON_SERVICE_URL ?? "http://127.0.0.1:8001";

  private readonly pythonApiKey = process.env.PYTHON_API_KEY ?? "";

  constructor(private clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTable();
    await this.ensureRunLogTable();
  }

  // ── Encryption helpers (хадгалахадаа дэмжиглэл) ────────────────────────

  private encryptConfig(plain: string): string {
    const hexKey = process.env.ENCRYPTION_KEY ?? "";
    if (hexKey.length < 64) return plain; // түлхүүр тохиргдоүгүй бол плайнтекстээр хадгална
    const key = Buffer.from(hexKey.slice(0, 64), "hex"); // 32 байт
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${iv.toString("hex")}.${ct.toString("hex")}.${tag.toString("hex")}`;
  }

  private decryptConfig(value: string): string {
    if (!value.startsWith("enc:")) return value;
    const hexKey = process.env.ENCRYPTION_KEY ?? "";
    if (hexKey.length < 64) {
      this.logger.warn(
        "ENCRYPTION_KEY тохиргдоүгүй — нууц үг тайлах боломжгүй",
      );
      return "{}";
    }
    try {
      const key = Buffer.from(hexKey.slice(0, 64), "hex");
      const [ivHex, ctHex, tagHex] = value.slice(4).split(".");
      const iv = Buffer.from(ivHex, "hex");
      const ct = Buffer.from(ctHex, "hex");
      const tag = Buffer.from(tagHex, "hex");
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
        "utf8",
      );
    } catch (e) {
      this.logger.error("Тайлан тохиргоо \u0442айлахад алдаа гарлаа:", e);
      return "{}";
    }
  }

  // ── Run log table ─────────────────────────────────────────────────────────

  private async ensureRunLogTable() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS python_api_run_logs (
          id           String,
          userId       String,
          userName     String DEFAULT '',
          toolId       String,
          toolName     String DEFAULT '',
          ranAt        DateTime DEFAULT now()
        ) ENGINE = MergeTree()
          ORDER BY (ranAt, userId)
      `);
    } catch (e) {
      this.logger.error("python_api_run_logs табли үүсгэхэд алдаа:", e);
    }
  }

  async logRun(
    userId: string,
    userName: string,
    toolId: string,
    toolName: string,
  ) {
    try {
      await this.clickhouse.insert("python_api_run_logs", [
        {
          id: randomUUID(),
          userId,
          userName,
          toolId,
          toolName,
          ranAt: nowCH(),
        },
      ]);
    } catch (e) {
      this.logger.warn("Лог бичихэд алдаа:", e);
    }
  }

  async getRunLogs(limit = 200): Promise<
    {
      id: string;
      userId: string;
      userName: string;
      toolId: string;
      toolName: string;
      ranAt: string;
    }[]
  > {
    return this.clickhouse.query<any>(
      `SELECT id, userId, userName, toolId, toolName, ranAt
       FROM python_api_run_logs
       ORDER BY ranAt DESC
       LIMIT {limit:UInt32}`,
      { limit },
    );
  }

  // ── Table setup ───────────────────────────────────────────────────────────

  private async ensureTable() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS python_api_tools (
          id               String,
          name             String,
          apiPath          String,
          description      String DEFAULT '',
          pythonCode       String,
          connectionType   String DEFAULT 'clickhouse',
          connectionConfig String DEFAULT '{}',
          outputFormat     String DEFAULT 'excel',
          dateMode         String DEFAULT 'none',
          color            String DEFAULT 'from-blue-500 to-cyan-500',
          filters          String DEFAULT '[]',
          isActive         UInt8  DEFAULT 1,
          seq              UInt64,
          createdAt        DateTime DEFAULT now(),
          updatedAt        String DEFAULT ''
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);
    } catch (e) {
      this.logger.error("python_api_tools table үүсгэхэд алдаа:", e);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getLatestTools(activeOnly = false): Promise<PythonApiTool[]> {
    const where = activeOnly ? "WHERE isActive = 1" : "";
    const raw = await this.clickhouse.query<PythonApiTool>(
      `SELECT *
       FROM (
         SELECT
           id,
           argMax(name, seq)             AS name,
           argMax(apiPath, seq)          AS apiPath,
           argMax(description, seq)      AS description,
           argMax(pythonCode, seq)       AS pythonCode,
           argMax(connectionType, seq)   AS connectionType,
           argMax(connectionConfig, seq) AS connectionConfig,
           argMax(outputFormat, seq)     AS outputFormat,
           argMax(dateMode, seq)         AS dateMode,
           argMax(color, seq)            AS color,
           argMax(filters, seq)          AS filters,
           argMax(isActive, seq)         AS isActive,
           argMax(updatedAt, seq)        AS updatedAt,
           min(createdAt)               AS createdAt
         FROM python_api_tools
         GROUP BY id
       )
       ${where}
       ORDER BY createdAt ASC`,
    );
    return raw.map((t) => ({
      ...t,
      connectionConfig: this.decryptConfig(t.connectionConfig ?? "{}"),
    }));
  }

  private async getToolById(id: string): Promise<PythonApiTool> {
    const rows = await this.clickhouse.query<PythonApiTool>(
      `SELECT
         id,
         argMax(name, seq)             AS name,
         argMax(apiPath, seq)          AS apiPath,
         argMax(description, seq)      AS description,
         argMax(pythonCode, seq)       AS pythonCode,
         argMax(connectionType, seq)   AS connectionType,
         argMax(connectionConfig, seq) AS connectionConfig,
         argMax(outputFormat, seq)     AS outputFormat,
         argMax(dateMode, seq)         AS dateMode,
         argMax(color, seq)            AS color,
         argMax(filters, seq)          AS filters,
         argMax(isActive, seq)         AS isActive,
         argMax(updatedAt, seq)        AS updatedAt,
         min(createdAt)               AS createdAt
       FROM python_api_tools
       WHERE id = {id:String}
       GROUP BY id`,
      { id },
    );
    if (!rows?.length) throw new NotFoundException("Python Tool олдсонгүй");
    return {
      ...rows[0],
      connectionConfig: this.decryptConfig(rows[0].connectionConfig ?? "{}"),
    };
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async getAllTools(): Promise<PythonApiTool[]> {
    return this.getLatestTools(false);
  }

  async getActiveTools(): Promise<
    Omit<PythonApiTool, "pythonCode" | "connectionConfig">[]
  > {
    const tools = await this.getLatestTools(true);
    return tools.map(
      ({ pythonCode: _p, connectionConfig: _c, ...rest }) => rest,
    );
  }

  /** Active tools filtered by user permission (admins see all) */
  async getActiveToolsForUser(
    userId: string,
    isAdmin: boolean,
  ): Promise<Omit<PythonApiTool, "pythonCode" | "connectionConfig">[]> {
    const tools = await this.getActiveTools();
    if (isAdmin) return tools;
    const permitted = await this.clickhouse.query<{ templateId: string }>(
      `SELECT DISTINCT templateId
       FROM excel_report_permissions
       WHERE userId = {uid:String}`,
      { uid: userId },
    );
    const ids = new Set(permitted.map((r) => r.templateId));
    return tools.filter((t) => ids.has(t.id));
  }

  /** Check if a user has permission for a specific tool */
  async hasPermission(userId: string, toolId: string): Promise<boolean> {
    const rows = await this.clickhouse.query<{ cnt: number }>(
      `SELECT count() AS cnt
       FROM excel_report_permissions
       WHERE userId = {uid:String} AND templateId = {tid:String}`,
      { uid: userId, tid: toolId },
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
  }

  async getAllPermissions(): Promise<
    { userId: string; templateId: string; grantedBy: string; grantedAt: string }[]
  > {
    return this.clickhouse.query<any>(
      `SELECT userId, templateId, grantedBy, grantedAt
       FROM excel_report_permissions
       ORDER BY grantedAt DESC`,
    );
  }

  async grantPermission(
    userId: string,
    templateId: string,
    grantedBy: string,
  ): Promise<void> {
    const exists = await this.hasPermission(userId, templateId);
    if (exists) return;
    await this.clickhouse.insert("excel_report_permissions", [
      { userId, templateId, grantedBy, grantedAt: nowCH() },
    ]);
  }

  async revokePermission(userId: string, templateId: string): Promise<void> {
    await this.clickhouse.exec(
      `ALTER TABLE excel_report_permissions DELETE
       WHERE userId = {uid:String} AND templateId = {tid:String}`,
      { uid: userId, tid: templateId },
    );
  }

  async createTool(dto: CreatePythonToolDto): Promise<PythonApiTool> {
    const id = randomUUID();
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("python_api_tools", [
      {
        id,
        name: dto.name,
        apiPath: dto.apiPath.replace(/[^a-z0-9_-]/gi, "-").toLowerCase(),
        description: dto.description ?? "",
        pythonCode: dto.pythonCode,
        connectionType: dto.connectionType ?? "clickhouse",
        connectionConfig: this.encryptConfig(dto.connectionConfig ?? "{}"),
        outputFormat: dto.outputFormat ?? "excel",
        dateMode: dto.dateMode ?? "none",
        color: dto.color ?? "from-blue-500 to-cyan-500",
        filters: dto.filters ?? "[]",
        isActive: 1,
        seq,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    return this.getToolById(id);
  }

  async updateTool(
    id: string,
    dto: UpdatePythonToolDto,
  ): Promise<PythonApiTool> {
    const existing = await this.getToolById(id);
    const seq = Date.now();
    const now = nowCH();
    const rawPath = dto.apiPath ?? existing.apiPath;
    await this.clickhouse.insert("python_api_tools", [
      {
        id,
        name: dto.name ?? existing.name,
        apiPath: rawPath.replace(/[^a-z0-9_-]/gi, "-").toLowerCase(),
        description: dto.description ?? existing.description,
        pythonCode: dto.pythonCode ?? existing.pythonCode,
        connectionType: dto.connectionType ?? existing.connectionType,
        connectionConfig: this.encryptConfig(
          dto.connectionConfig ?? existing.connectionConfig,
        ),
        outputFormat: dto.outputFormat ?? existing.outputFormat,
        dateMode: dto.dateMode ?? existing.dateMode,
        color: dto.color ?? existing.color,
        filters: dto.filters ?? existing.filters,
        isActive: existing.isActive,
        seq,
        createdAt: existing.createdAt,
        updatedAt: now,
      },
    ]);
    return this.getToolById(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<PythonApiTool> {
    const existing = await this.getToolById(id);
    const seq = Date.now();
    const now = nowCH();
    await this.clickhouse.insert("python_api_tools", [
      { ...existing, isActive: isActive ? 1 : 0, seq, updatedAt: now },
    ]);
    return this.getToolById(id);
  }

  async deleteTool(id: string): Promise<void> {
    await this.getToolById(id);
    await this.clickhouse.exec(
      `ALTER TABLE python_api_tools DELETE WHERE id = {id:String}`,
      { id },
    );
  }

  // ── FastAPI proxy helper ──────────────────────────────────────────────────

  private callFastApi(path: string, body: object): Promise<Buffer> {
    const payload = Buffer.from(JSON.stringify(body), "utf-8");
    const url = new URL(path, this.pythonServiceUrl);
    const isHttps = url.protocol === "https:";
    const transport: typeof http = isHttps
      ? (require("https") as typeof http)
      : http;

    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          hostname: url.hostname,
          port: Number(url.port) || (isHttps ? 443 : 8001),
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": payload.length,
            ...(this.pythonApiKey
              ? { "x-api-key": this.pythonApiKey }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const buf = Buffer.concat(chunks);
            if ((res.statusCode ?? 0) === 200) {
              resolve(buf);
            } else {
              let detail = buf.toString("utf-8").slice(0, 500);
              try {
                detail =
                  (JSON.parse(detail) as { detail?: string }).detail ?? detail;
              } catch {
                /* plain text */
              }
              reject(new BadRequestException(`Python сервис алдаа: ${detail}`));
            }
          });
        },
      );
      req.on("error", (e: Error) => {
        this.logger.error(`Python сервис холбогдохд алдаа: ${e.message}`);
        reject(
          new InternalServerErrorException(
            "Python тайлангийн сервис ажиллагдаагүй байна.",
          ),
        );
      });
      req.write(payload);
      req.end();
    });
  }

  // ── Run tool ──────────────────────────────────────────────────────────────

  async runTool(
    dto: RunToolDto,
    caller?: { userId: string; userName: string; isAdmin: boolean },
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const tool = await this.getToolById(dto.toolId);
    if (!tool.isActive) throw new BadRequestException("Tool идэвхгүй байна");

    if (tool.dateMode === "range" && (!dto.startDate || !dto.endDate))
      throw new BadRequestException("Эхлэх болон дуусах огноо шаардлагатай");
    if (tool.dateMode === "single" && !dto.startDate)
      throw new BadRequestException("Огноо шаардлагатай");

    let connectionConfig: object | undefined;
    try {
      connectionConfig =
        tool.connectionConfig && tool.connectionConfig !== "{}"
          ? (JSON.parse(tool.connectionConfig) as object)
          : undefined;
    } catch {
      connectionConfig = undefined;
    }

    const buffer = await this.callFastApi("/run-tool", {
      code: tool.pythonCode,
      connection_type: tool.connectionType ?? "clickhouse",
      connection_config: connectionConfig,
      start_date: dto.startDate ?? null,
      end_date: dto.endDate ?? dto.startDate ?? null,
      filters: dto.filters ?? {},
      output_format: tool.outputFormat ?? "excel",
    });

    const date = new Date().toISOString().slice(0, 10);
    const ext = tool.outputFormat === "csv" ? "csv" : "xlsx";
    const contentTypes: Record<string, string> = {
      excel:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv; charset=utf-8",
    };

    // ── Audit log ─────────────────────────────────────────────────────────────
    if (caller?.userId) {
      void this.logRun(caller.userId, caller.userName, tool.id, tool.name);
    }

    return {
      buffer,
      fileName: `${tool.name}_${date}.${ext}`,
      contentType: contentTypes[tool.outputFormat ?? "excel"],
    };
  }

  async previewTool(
    dto: RunToolDto,
  ): Promise<{ columns: string[]; rows: any[][]; totalCount: number }> {
    const tool = await this.getToolById(dto.toolId);
    if (!tool.isActive) throw new BadRequestException("Tool идэвхгүй байна");

    let connectionConfig: object | undefined;
    try {
      connectionConfig =
        tool.connectionConfig && tool.connectionConfig !== "{}"
          ? (JSON.parse(tool.connectionConfig) as object)
          : undefined;
    } catch {
      connectionConfig = undefined;
    }

    const buf = await this.callFastApi("/preview-tool", {
      code: tool.pythonCode,
      connection_type: tool.connectionType ?? "clickhouse",
      connection_config: connectionConfig,
      start_date: dto.startDate ?? null,
      end_date: dto.endDate ?? dto.startDate ?? null,
      filters: dto.filters ?? {},
      output_format: tool.outputFormat ?? "excel",
      preview_limit: 50,
    });

    return JSON.parse(buf.toString("utf-8")) as {
      columns: string[];
      rows: any[][];
      totalCount: number;
    };
  }
}

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
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
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
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PythonApiService implements OnModuleInit {
  private readonly logger = new Logger(PythonApiService.name);

  private readonly pythonServiceUrl =
    process.env.PYTHON_SERVICE_URL ??
    process.env.PYTHON_API_URL ??
    "http://127.0.0.1:8001";

  private readonly pythonApiKey = process.env.PYTHON_API_KEY ?? "";

  constructor(private clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureTable();
    await this.ensureRunLogTable();
    await this.ensurePermissionsTable();
  }

  private async ensurePermissionsTable() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS excel_report_permissions (
          userId       String,
          templateId   String,
          grantedBy    String,
          grantedAt    DateTime DEFAULT now()
        ) ENGINE = MergeTree()
          ORDER BY (userId, templateId)
      `);
    } catch (e) {
      this.logger.error("excel_report_permissions таблиц үүсгэхэд алдаа:", e);
    }
  }

  // [C-3] AES-256-GCM encryption for connectionConfig at rest in ClickHouse.
  // Key derived from JWT_SECRET via SHA-256 — reuses an already-required secret
  // so no extra env var is needed. Format: enc:v1:<base64(iv|tag|ciphertext)>
  private readonly encKey: Buffer = (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 16) {
      throw new Error(
        "JWT_SECRET (>=16 chars) is required — it is reused for python-api config encryption",
      );
    }
    return createHash("sha256").update("py-tool-cfg:" + secret).digest();
  })();

  private encryptConfig(plain: string): string {
    if (!plain || plain === "{}") return plain;
    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.encKey, iv);
      const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return "enc:v1:" + Buffer.concat([iv, tag, ct]).toString("base64");
    } catch (e) {
      this.logger.error("connectionConfig encrypt failed", e);
      throw new InternalServerErrorException(
        "Тохиргоо шифрлэхэд алдаа гарлаа",
      );
    }
  }

  private decryptConfig(value: string): string {
    if (!value) return "{}";
    if (!value.startsWith("enc:v1:")) {
      // Backward-compat: legacy plaintext rows. Re-encrypted on next save.
      return value;
    }
    try {
      const buf = Buffer.from(value.slice("enc:v1:".length), "base64");
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const ct = buf.subarray(28);
      const decipher = createDecipheriv("aes-256-gcm", this.encKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
    } catch (e) {
      this.logger.warn(
        "connectionConfig decrypt failed — admin must re-save the tool config",
      );
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
          sortOrder        Int32  DEFAULT 1000000,
          seq              UInt64,
          createdAt        DateTime DEFAULT now(),
          updatedAt        String DEFAULT ''
        ) ENGINE = MergeTree() ORDER BY (id, seq)
      `);
      // Backward-compat: add sortOrder if upgrading an older deployment
      await this.clickhouse
        .exec(
          `ALTER TABLE python_api_tools ADD COLUMN IF NOT EXISTS sortOrder Int32 DEFAULT 1000000`,
        )
        .catch(() => {});
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
           argMax(sortOrder, seq)        AS sortOrder,
           argMax(updatedAt, seq)        AS updatedAt,
           min(createdAt)               AS createdAt
         FROM python_api_tools
         GROUP BY id
       )
       ${where}
       ORDER BY sortOrder ASC, createdAt ASC`,
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
         argMax(sortOrder, seq)        AS sortOrder,
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
    // [SORT] New tools default to a high sortOrder so they appear at the end
    // until an admin reorders them; tail-of-list semantics.
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
        sortOrder: 1000000,
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
        sortOrder: existing.sortOrder ?? 1000000,
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

  /** [SORT] Reorder tools. Accepts an array of tool ids in desired display
   * order; assigns sortOrder = index * 10 to each so subsequent partial
   * reorders can squeeze items between without rewriting everything.
   * Tools not present in the list keep their current sortOrder. */
  async reorderTools(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const uniq = Array.from(new Set(ids.filter((s) => typeof s === "string" && s.length > 0)));
    const now = nowCH();
    const baseSeq = Date.now();
    const rows: any[] = [];
    for (let i = 0; i < uniq.length; i++) {
      const id = uniq[i];
      let existing: PythonApiTool;
      try {
        existing = await this.getToolById(id);
      } catch {
        continue; // skip missing ids silently
      }
      rows.push({
        ...existing,
        connectionConfig: this.encryptConfig(existing.connectionConfig),
        sortOrder: i * 10,
        seq: baseSeq + i,
        updatedAt: now,
      });
    }
    if (rows.length > 0) {
      await this.clickhouse.insert("python_api_tools", rows);
    }
  }

  async deleteTool(id: string): Promise<void> {
    await this.getToolById(id);
    await this.clickhouse.exec(
      `ALTER TABLE python_api_tools DELETE WHERE id = {id:String}`,
      { id },
    );
  }

  // ── FastAPI proxy helper ──────────────────────────────────────────────────

  private callFastApi(path: string, body: object, signal?: AbortSignal): Promise<Buffer> {
    const payload = Buffer.from(JSON.stringify(body), "utf-8");
    const url = new URL(path, this.pythonServiceUrl);
    const isHttps = url.protocol === "https:";
    const transport: typeof http = isHttps
      ? (require("https") as typeof http)
      : http;

    // [M-2] Том тайлан хязгааргүй ажиллах боломжтой. 0 = no timeout.
    const reqTimeoutMs = 0;

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

      // Client disconnect/cancel → upstream socket-ийг таслана
      const onAbort = () => {
        req.destroy();
        reject(Object.assign(new Error("Таталтыг зогсоолоо"), { code: "CLIENT_CANCELED" }));
      };
      if (signal) {
        if (signal.aborted) {
          req.destroy();
          reject(Object.assign(new Error("Таталтыг зогсоолоо"), { code: "CLIENT_CANCELED" }));
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
      // [M-2] Hard timeout to prevent hung sockets exhausting the connection pool
      if (reqTimeoutMs > 0) {
        req.setTimeout(reqTimeoutMs, () => {
          req.destroy(new Error(`Python сервис ${reqTimeoutMs}ms timeout`));
        });
      }
      req.on("error", (e: Error) => {
        signal?.removeEventListener("abort", onAbort);
        if ((e as any).code === "CLIENT_CANCELED" || signal?.aborted) return; // suppress
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
    signal?: AbortSignal,
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
    }, signal);

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
  ): Promise<{
    columns: string[];
    rows: any[][];
    totalCount: number;
    cacheKey?: string;
  }> {
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
      cacheKey?: string;
    };
  }
}

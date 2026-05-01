import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import * as oracledb from "oracledb";

@Injectable()
export class OracleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OracleService.name);
  private pool: oracledb.Pool | null = null;
  private authFailed = false; // credential буруу бол дахин оролдохгүй

  onModuleInit() {
    const user = process.env.ORACLE_USER;
    const password = process.env.ORACLE_PASSWORD;
    const connectString = process.env.ORACLE_CONNECT_STRING;

    if (!user || !password || !connectString) {
      this.logger.warn(
        "Oracle credentials not configured — Oracle queries will be unavailable",
      );
      return;
    }

    this.initPool(user, password, connectString).catch(() => {});
  }

  // ORA-01017: invalid username/password
  // ORA-28000: the account is locked
  // ORA-28001: the password has expired
  private static readonly AUTH_ERROR_CODES = [1017, 28000, 28001];

  private async initPool(
    user: string,
    password: string,
    connectString: string,
  ) {
    if (this.authFailed) {
      this.logger.warn(
        "Oracle auth previously failed — skipping reconnect to prevent account lock",
      );
      return;
    }

    try {
      this.pool = await oracledb.createPool({
        user,
        password,
        connectString,
        poolMin: 0,
        poolMax: 5,
        poolIncrement: 1,
        poolTimeout: 60,
        connectTimeout: 10,
      });
      this.logger.log(`Oracle pool connected → ${connectString}`);
    } catch (err: any) {
      const code = err?.errorNum || 0;
      if (OracleService.AUTH_ERROR_CODES.includes(code)) {
        this.authFailed = true;
        this.logger.error(
          `Oracle auth error (ORA-${code}): ${err.message}. ` +
            `Дахин оролдохгүй — account lock-аас хамгаалж байна. ` +
            `.env файлд ORACLE_USER/ORACLE_PASSWORD шалгана уу.`,
        );
      } else {
        this.logger.error(`Oracle pool creation failed: ${err.message}`);
      }
      this.pool = null;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      try {
        await this.pool.close(0);
      } catch (_) {}
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async query<T = Record<string, any>>(
    sql: string,
    params: any[] = [],
  ): Promise<T[]> {
    if (!this.pool) {
      throw new Error("Oracle холболт тохируулагдаагүй байна");
    }

    const trimmed = sql.replace(/\s+/g, " ").trim();

    const startsWithSelect = /^(WITH\s+|SELECT\s)/i.test(trimmed);
    if (!startsWithSelect) {
      this.logger.error(
        `BLOCKED non-SELECT query: ${trimmed.substring(0, 120)}`,
      );
      throw new Error("Зөвхөн SELECT query зөвшөөрнө.");
    }

    const dangerous = [
      "INSERT",
      "UPDATE",
      "DELETE",
      "DROP",
      "CREATE",
      "ALTER",
      "TRUNCATE",
      "RENAME",
      "REPLACE",
      "MERGE",
      "UPSERT",
      "GRANT",
      "REVOKE",
      "EXEC",
      "EXECUTE",
      "CALL",
      "COMMIT",
      "ROLLBACK",
      "SAVEPOINT",
      "DBMS_",
      "UTL_",
    ];
    for (const kw of dangerous) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(trimmed)) {
        this.logger.error(`BLOCKED dangerous keyword "${kw}" in query`);
        throw new Error(`"${kw}" үйлдэл хориглосон. Зөвхөн SELECT зөвшөөрнө.`);
      }
    }

    const conn = await this.pool.getConnection();
    try {
      const result = await conn.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchArraySize: 1000,
      });
      return (result.rows || []) as T[];
    } finally {
      await conn.close();
    }
  }

  /**
   * Stored procedure-ийг SYS_REFCURSOR гаралттайгаар дуудна.
   * Зөвхөн whitelist-д орсон procedure нэрсийг зөвшөөрнө (SQL-injection-аас хамгаална).
   *
   * @param procName "SCHEMA.PROC_NAME" формат
   * @param inParams Дараалсан IN параметрүүд (proc-ийн дарааллаар)
   * @param allowList Зөвшөөрөгдсөн procedure нэрсийн жагсаалт
   */
  async callRefCursorProc<T = Record<string, any>>(
    procName: string,
    inParams: any[],
    allowList: readonly string[],
  ): Promise<T[]> {
    if (!this.pool) {
      throw new Error("Oracle холболт тохируулагдаагүй байна");
    }
    const normalized = procName.trim().toUpperCase();
    if (!allowList.map((s) => s.toUpperCase()).includes(normalized)) {
      this.logger.error(`BLOCKED procedure call: ${procName}`);
      throw new Error(`Procedure "${procName}" зөвшөөрөгдөөгүй.`);
    }
    if (!/^[A-Z0-9_]+(\.[A-Z0-9_]+)?$/.test(normalized)) {
      throw new Error("Procedure нэр буруу формат");
    }

    const conn = await this.pool.getConnection();
    try {
      const placeholders = inParams.map((_, i) => `:p${i}`).join(", ");
      const sql = `BEGIN ${normalized}(${placeholders}${
        inParams.length ? ", " : ""
      }:cur); END;`;

      const binds: Record<string, any> = {
        cur: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
      };
      inParams.forEach((v, i) => {
        binds[`p${i}`] = v;
      });

      const result = await conn.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });

      const cursor = (result.outBinds as any)?.cur as oracledb.ResultSet<T>;
      if (!cursor) return [];
      const rows: T[] = [];
      try {
        while (true) {
          const batch = await cursor.getRows(1000);
          if (!batch.length) break;
          rows.push(...batch);
        }
      } finally {
        await cursor.close();
      }
      return rows;
    } finally {
      await conn.close();
    }
  }
}

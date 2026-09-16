// Minimal ambient declaration for `oracledb` — зөвхөн oracle.service.ts-ийн
// ашигладаг хэсэг (@types/oracledb dependency нэмэхгүйн тулд, compression.d.ts-тэй ижил).
declare module "oracledb" {
  export const OUT_FORMAT_OBJECT: number;
  export const CURSOR: number;
  export const BIND_OUT: number;

  export type BindValue =
    | string
    | number
    | boolean
    | Date
    | null
    | { type: number; dir: number };

  export type BindParameters = BindValue[] | Record<string, BindValue>;

  export interface ExecuteOptions {
    outFormat?: number;
    fetchArraySize?: number;
    maxRows?: number;
  }

  export interface ResultSet<T> {
    getRows(numRows: number): Promise<T[]>;
    close(): Promise<void>;
  }

  export interface Result<T> {
    rows?: T[];
    outBinds?: Record<string, unknown>;
  }

  export interface Connection {
    execute<T = unknown>(
      sql: string,
      binds?: BindParameters,
      options?: ExecuteOptions,
    ): Promise<Result<T>>;
    close(): Promise<void>;
  }

  export interface Pool {
    getConnection(): Promise<Connection>;
    close(drainTime?: number): Promise<void>;
  }

  export interface PoolAttributes {
    user: string;
    password: string;
    connectString: string;
    poolMin?: number;
    poolMax?: number;
    poolIncrement?: number;
    poolTimeout?: number;
    connectTimeout?: number;
  }

  export function createPool(attrs: PoolAttributes): Promise<Pool>;
}

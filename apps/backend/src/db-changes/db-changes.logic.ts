/**
 * Өгөгдлийн сангийн өөрчлөлт — цэвэр функцүүд (DB-гүй, тестлэгдэнэ).
 *
 * Эх сурвалж: өмнөх "DB analyze" систем (Projects/Db analyze) —
 * `data_processor/views.py` (get_system_type, get_language).
 * Oracle audit trail-ийн Excel экспортыг хадгалж, системээр ангилна.
 */

export const SYSTEM_TYPES = [
  "Кор систем",
  "Картзоне",
  "Интернэт банк",
  "Бусад",
] as const;
export type SystemType = (typeof SYSTEM_TYPES)[number];

/** OWNER (схем)-ээс системийн төрлийг тодорхойлно — эх кодын дүрэмтэй ижил. */
export function systemTypeOf(owner: string | null | undefined): SystemType {
  const value = (owner ?? "").trim().toLowerCase();
  if (!value) return "Бусад";
  if (value === "cardzone" || value === "toad") return "Картзоне";
  if (value === "ececuser") return "Интернэт банк";
  return "Кор систем";
}

export const SQL_COMMANDS = [
  "drop",
  "create",
  "update",
  "delete",
  "other",
] as const;
export type SqlCommand = (typeof SQL_COMMANDS)[number];

/**
 * SQL текстээс командын төрөл — эх кодтой ижил дарааллаар (drop хамгийн түрүүнд,
 * учир нь хамгийн эрсдэлтэй). Дэд мөрөөр шалгадаг тул "CREATE ... UPDATE" гэвэл create.
 */
export function sqlCommandOf(sqlText: string | null | undefined): SqlCommand {
  const text = (sqlText ?? "").toLowerCase();
  if (text.includes("drop")) return "drop";
  if (text.includes("create")) return "create";
  if (text.includes("update")) return "update";
  if (text.includes("delete")) return "delete";
  return "other";
}

export interface DbChangeRowInput {
  /** YYYY-MM-DD HH:MM:SS */
  actionTime: string;
  username: string;
  machine: string;
  action: string;
  owner: string;
  objectName: string;
  domain: string;
  sqlText: string;
  sourceDescription: string;
  jira: string;
}

const clean = (v: string | null | undefined) =>
  (v ?? "").trim().replace(/\s+/g, " ");

/** Хадгалахаас өмнө нэг хэлбэрт оруулна. SQL текстийн мөр шилжилтийг хадгална. */
export function normalizeDbChangeRow(row: DbChangeRowInput): DbChangeRowInput {
  return {
    actionTime: clean(row.actionTime),
    // Oracle-ийн хэрэглэгч, схемийн нэр том/жижиг үсэг ялгадаггүй — нэг хэрэглэгч хоёр тоологдохгүй
    username: clean(row.username).toUpperCase(),
    machine: clean(row.machine),
    action: clean(row.action).toUpperCase(),
    owner: clean(row.owner).toUpperCase(),
    objectName: clean(row.objectName),
    domain: clean(row.domain),
    sqlText: (row.sqlText ?? "").trim(),
    sourceDescription: clean(row.sourceDescription),
    jira: clean(row.jira),
  };
}

/** Давхардал таних түлхүүр — нэг үйлдлийг дахин оруулахад шинэ мөр үүсэхгүй. */
export function dbChangeRowKey(row: DbChangeRowInput): string {
  return [
    row.actionTime,
    row.username,
    row.machine.toLowerCase(),
    row.action,
    row.owner,
    row.objectName.toLowerCase(),
    row.domain.toLowerCase(),
    row.sqlText,
  ].join("|");
}

/** YYYY-MM-DD HH:MM:SS бөгөөд бодит огноо/цаг эсэх */
export function isValidDateTime(value: string): boolean {
  const m = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return false;
  const d = new Date(`${m[1]}T00:00:00Z`);
  return (
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === m[1] &&
    Number(m[2]) < 24 &&
    Number(m[3]) < 60 &&
    Number(m[4]) < 60
  );
}

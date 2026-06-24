import { DEPARTMENT_CODES } from "../constants/departments";

/**
 * Generates a deterministic user ID from department and name.
 * Single source of truth — replaces duplicated logic in auth.service and users.service.
 *
 * `code` — хэлтсийн динамик prefix код (DB-аас). Хоосон бол хуучин
 * DEPARTMENT_CODES map руу fallback хийнэ.
 */
export function buildUserId(
  department: string,
  name: string,
  code?: string,
): string {
  const deptCode =
    (code && code.trim()) || DEPARTMENT_CODES[department] || "USR";
  const namePart = name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("-")
    .replace(/\s+/g, "");
  if (department === "Удирдлага") return `.${namePart}-${deptCode}`;
  if (department === "Дата анализын алба") return `${deptCode}-${namePart}`;
  return `DAG-${deptCode}-${namePart}`;
}

/**
 * Safe JSON.parse for allowedTools / grantableTools — ClickHouse returns a String column.
 * Returns [] if the value is missing, already an array, or contains corrupt JSON.
 */
/** Админ / супер админ эсэх (ClickHouse UInt8 → number | string) */
export function isPrivilegedUser(u: {
  isAdmin?: unknown;
  isSuperAdmin?: unknown;
}): boolean {
  return Number(u.isAdmin) === 1 || Number(u.isSuperAdmin) === 1;
}

/** SQL fragment — веб (ажилтнууд, нэвтрэх хайлт) дээр харагдах хэрэглэгчид */
export function webVisibleUserSql(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `${p}isAdmin = 0
  AND ${p}isSuperAdmin = 0
  AND lower(${p}name) NOT LIKE '%system admin%'
  AND lower(${p}name) NOT LIKE '%system%admin%'`;
}

/** Alias-гүй хувилбар (departments.service) */
export const WEB_VISIBLE_USER_SQL = webVisibleUserSql();

export function safeParseTools(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

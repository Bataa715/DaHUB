import { DEPARTMENT_CODES } from "../constants/departments";

/** Хэлтсийн/газрын захирал эсэх (албан тушаалаар). */
export function isDirectorPosition(position?: string): boolean {
  return String(position ?? "")
    .toLowerCase()
    .includes("захирал");
}

/**
 * Захирлын userId: .Bilegzaya-DAG-MTAH
 * - code = MTAH     → .Name-DAG-MTAH
 * - code = DAG-DAA  → .Name-DAG-DAA
 * - code = DAG      → .Name-DAG
 */
function formatDirectorUserId(namePart: string, deptCode: string): string {
  const code = (deptCode || "DAG").trim();
  if (/^DAG-/i.test(code)) return `.${namePart}-${code}`;
  if (/^DAG$/i.test(code)) return `.${namePart}-DAG`;
  return `.${namePart}-DAG-${code}`;
}

/**
 * Generates a deterministic user ID from department, name, code, and position.
 * Single source of truth — replaces duplicated logic in auth.service and users.service.
 *
 * `code` — хэлтсийн динамик prefix код (DB-аас). Хоосон бол хуучин
 * DEPARTMENT_CODES map руу fallback хийнэ.
 *
 * Формат:
 * - Захирал / Удирдлага: `.Bilegzaya-DAG-MTAH`
 * - Дата анализын алба:   `DAA-Name` / `DAG-DAA-Name` (захиралгүй)
 * - Бусад ажилтан:        `DAG-MTAH-Name`
 */
export function buildUserId(
  department: string,
  name: string,
  code?: string,
  position?: string,
): string {
  const deptCode =
    (code && code.trim()) || DEPARTMENT_CODES[department] || "USR";
  const namePart = name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("-")
    .replace(/\s+/g, "");

  // DAA-д захирал байхгүй — захирлын (.Name-DAG-…) формат хэрэглэхгүй
  if (department === "Дата анализын алба") return `${deptCode}-${namePart}`;

  if (isDirectorPosition(position) || department === "Удирдлага") {
    return formatDirectorUserId(namePart, deptCode);
  }

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

import {
  DEPARTMENT_CODES,
  NO_DAG_PREFIX_DEPARTMENTS,
  NO_DIRECTOR_DEPARTMENTS,
} from "../constants/departments";
import { nowCH } from "../../clickhouse/clickhouse.service";

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
 * - noDagPrefix     → .Name-CHBA
 */
function formatDirectorUserId(
  namePart: string,
  deptCode: string,
  withDagPrefix = true,
): string {
  const code = (deptCode || "DAG").trim();
  if (!withDagPrefix) return `.${namePart}-${code}`;
  if (/^DAG-/i.test(code)) return `.${namePart}-${code}`;
  if (/^DAG$/i.test(code)) return `.${namePart}-DAG`;
  return `.${namePart}-DAG-${code}`;
}

/** Энгийн ажилтны userId: DAG-MTAH-Name / DAG-DAA-Name / CHBA-Name */
function formatStaffUserId(
  namePart: string,
  deptCode: string,
  withDagPrefix = true,
): string {
  const code = (deptCode || "USR").trim();
  if (!withDagPrefix) return `${code}-${namePart}`;
  if (/^DAG-/i.test(code)) return `${code}-${namePart}`;
  return `DAG-${code}-${namePart}`;
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
 * - Ихэнх ажилтан:        `DAG-MTAH-Name`, `DAG-DAA-Name`
 * - CHBA (DAG-гүй):       `CHBA-Name`
 * - DAA / CHBA: захирал байхгүй (staff ID л)
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

  const withDagPrefix = !NO_DAG_PREFIX_DEPARTMENTS.has(department);

  // DAA, CHBA — захирал байхгүй
  if (NO_DIRECTOR_DEPARTMENTS.has(department)) {
    return formatStaffUserId(namePart, deptCode, withDagPrefix);
  }

  if (isDirectorPosition(position) || department === "Удирдлага") {
    return formatDirectorUserId(namePart, deptCode, withDagPrefix);
  }

  return formatStaffUserId(namePart, deptCode, withDagPrefix);
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

/**
 * Single source of truth for reconstructing a full `users` table row for the
 * DELETE+INSERT "replace" pattern (see ClickHouseService.replaceRows). Every
 * mutation site (auth.service.ts's password/last-login updates,
 * users.service.ts's admin edits) MUST route through this so a field simply
 * missing from one call site's hand-written object literal can't silently
 * reset it to the column default — this is exactly how `isLocked` /
 * `failedLoginCount` (account-lockout state) would get wiped by an unrelated
 * edit (e.g. an admin renaming someone) if a call site forgot to carry them
 * forward.
 */
export function buildUsersTableRow(
  existing: Record<string, any>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: existing.id,
    userId: existing.userId,
    password: existing.password ?? "",
    name: existing.name ?? "",
    position: existing.position ?? "",
    profileImage: existing.profileImage ?? "",
    departmentId: existing.departmentId ?? "",
    isAdmin: Number(existing.isAdmin) || 0,
    isSuperAdmin: Number(existing.isSuperAdmin) || 0,
    isActive: existing.isActive === undefined ? 1 : Number(existing.isActive),
    allowedTools:
      typeof existing.allowedTools === "string"
        ? existing.allowedTools
        : JSON.stringify(existing.allowedTools ?? []),
    grantableTools:
      typeof existing.grantableTools === "string"
        ? existing.grantableTools
        : JSON.stringify(existing.grantableTools ?? []),
    // [SEC] Persistent brute-force lockout — separate from the time-window
    // IP-scoped lockout in auth.service.ts. Only an admin unlock (or a
    // successful login) clears these.
    isLocked: Number(existing.isLocked) || 0,
    failedLoginCount: Number(existing.failedLoginCount) || 0,
    lastLoginAt: existing.lastLoginAt ?? null,
    createdAt: existing.createdAt,
    updatedAt: nowCH(),
    ...overrides,
  };
}

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

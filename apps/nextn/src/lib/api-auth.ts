import { jwtVerify, type JWTPayload } from "jose";
import type { NextRequest } from "next/server";

/**
 * Route Handler (`app/api/**`) дотор ашиглах JWT баталгаажуулалт.
 * `proxy.ts` нь `/api/*` замуудыг эргэн шилжилтээс (redirect) хасдаг тул
 * DB/файлтай шууд харьцдаг API route бүр өөрөө нэвтрэлтээ шалгах ёстой.
 *
 * ⚠️ Зөвхөн cookie байгаа эсэхийг шалгах нь хангалтгүй — HttpOnly нь зөвхөн
 * хөтчийн JS-ийг хориглодог, шууд HTTP хүсэлтэнд дурын утга бүхий cookie
 * илгээхээс хамгаалахгүй. Тиймээс JWT_SECRET-ээр firmly verify хийнэ.
 */
export async function getApiAuth(
  req: NextRequest | Request,
): Promise<JWTPayload | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("JWT_SECRET environment variable is not set");
    return null;
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  // Хугацаа дуусаагүй cookie-г эхлээд оролдоно (adminToken expired + token OK үед 403/401-ээс сэргийлнэ)
  const candidates = [
    readCookie(cookieHeader, "adminToken"),
    readCookie(cookieHeader, "token"),
  ].filter((t): t is string => !!t);

  if (candidates.length === 0) return null;

  const secret = new TextEncoder().encode(jwtSecret);
  for (const token of candidates) {
    try {
      const { payload } = await jwtVerify(token, secret);
      return payload;
    } catch {
      // дараагийн cookie
    }
  }
  return null;
}

export function isAdminPayload(payload: JWTPayload | null): boolean {
  if (!payload) return false;
  return (
    payload["isAdmin"] === true ||
    payload["isAdmin"] === 1 ||
    payload["isSuperAdmin"] === true ||
    payload["isSuperAdmin"] === 1
  );
}

export function isSuperAdminPayload(payload: JWTPayload | null): boolean {
  if (!payload) return false;
  return payload["isSuperAdmin"] === true || payload["isSuperAdmin"] === 1;
}

/** JWT claim-д array эсвэл JSON string хэлбэрээр ирж болно. */
export function parseAllowedTools(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return raw.trim() ? [raw.trim()] : [];
    }
  }
  return [];
}

/**
 * `proxy.ts`-ийн TOOL_GUARDS-тай ижил дүрэм: админ/супер админ бол
 * үргэлж эрхтэй, эсрэг тохиолдолд `allowedTools`-д заасан tool id байгаа эсэхийг шалгана.
 */
export function hasToolAccess(
  payload: JWTPayload | null,
  toolIds: string[],
): boolean {
  if (!payload) return false;
  if (isAdminPayload(payload)) return true;
  const allowed = parseAllowedTools(payload["allowedTools"]);
  return toolIds.some((t) => allowed.includes(t));
}

/**
 * [AUDIT/CSRF] Mutation (non-GET) route handler-т дуудаж cross-site хүсэлтийг
 * татгалзана. Origin header байгаа бөгөөд өөрийн host-той таарахгүй бол —
 * эсвэл Sec-Fetch-Site: cross-site бол — false буцаана. Origin байхгүй
 * (curl, server-to-server) хүсэлтийг cookie auth давхар хамгаалдаг тул нэвтэрнэ.
 */
export function isSameOriginRequest(req: Request): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function readCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.slice(name.length + 1));
}

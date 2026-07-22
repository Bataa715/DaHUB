import { jwtVerify, type JWTPayload } from "jose";
import type { NextRequest } from "next/server";

/**
 * Route Handler (`app/api/**`) дотор ашиглах JWT баталгаажуулалт.
 * `middleware.ts` нь `/api/*` замуудыг эргэн шилжилтээс (redirect) хасдаг тул
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
  const token =
    readCookie(cookieHeader, "token") ?? readCookie(cookieHeader, "adminToken");
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export function isAdminPayload(payload: JWTPayload | null): boolean {
  if (!payload) return false;
  return payload["isAdmin"] === true || payload["isAdmin"] === 1;
}

/**
 * `middleware.ts`-ийн TOOL_GUARDS-тай ижил дүрэм: админ/супер админ бол
 * үргэлж эрхтэй, эсрэг тохиолдолд `allowedTools`-д заасан tool id байгаа эсэхийг шалгана.
 */
export function hasToolAccess(
  payload: JWTPayload | null,
  toolIds: string[],
): boolean {
  if (!payload) return false;
  if (isAdminPayload(payload) || payload["isSuperAdmin"] === true) return true;
  const allowed = (payload["allowedTools"] as string[] | undefined) ?? [];
  return toolIds.some((t) => allowed.includes(t));
}

function readCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.slice(name.length + 1));
}

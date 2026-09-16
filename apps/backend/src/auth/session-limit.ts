import { randomUUID } from "crypto";

/**
 * [SEC] Сессийн үнэмлэхүй дээд хугацаа.
 *
 * Refresh token нь 3 цаг хүчинтэй бөгөөд refresh бүр ШИНЭ 3 цагийн token
 * олгодог тул идэвхтэй сесс (эсвэл хулгайлагдсан cookie) хэзээ ч дуусахгүй
 * байсан. Нэвтэрсэн агшнаас хойш 12 цаг (ажлын өдөр) өнгөрвөл refresh-ийг
 * татгалзаж дахин нэвтрүүлнэ.
 */
export const MAX_SESSION_SECONDS = 12 * 3600;

/**
 * Сессийн эхлэх агшинг token дотор хадгална: `<uuid>.<эхэлсэн epoch>`.
 * DB-д бүтэн мөрийн SHA-256 hash хадгалагддаг тул эхлэх хугацааг өөрчилбөл
 * hash таарахгүй — хуурах боломжгүй, схем өөрчлөх шаардлагагүй.
 */
export function buildRefreshToken(sessionStartEpoch: number): string {
  return `${randomUUID()}.${Math.floor(sessionStartEpoch)}`;
}

/**
 * Token-оос сессийн эхлэх агшинг уншина. Хуучин хэлбэрийн (цэггүй) token-д
 * эхлэх хугацаа байхгүй тул `nowEpoch`-ийг буцаана — deploy хийх үед нэвтэрсэн
 * хэрэглэгчид гэнэт гарахгүй, харин тэр агшнаас 12 цаг тоологдоно.
 */
export function sessionStartOf(token: string, nowEpoch: number): number {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return nowEpoch;
  const start = Number(token.slice(dot + 1));
  if (!Number.isInteger(start) || start <= 0 || start > nowEpoch + 60) {
    return nowEpoch;
  }
  return start;
}

export function isSessionExpired(
  sessionStartEpoch: number,
  nowEpoch: number,
): boolean {
  return nowEpoch - sessionStartEpoch > MAX_SESSION_SECONDS;
}

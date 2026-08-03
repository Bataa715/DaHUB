import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for authenticated knowledge (medleg) images.
 * Reads the HttpOnly token cookie and forwards to backend /medleg/:id/image.
 *
 * ⚠️ Домэйнтэй deploy хийсний дараа зураг ачаалагдахгүй бол:
 *   Энэ route нь СЕРВЕР талд ажиллаж backend руу fetch хийдэг. Public домэйн
 *   (https://domain.mn) руу серверийн дотроос хандах нь ихэвчлэн бүтэлгүйтдэг
 *   (hairpin NAT / дотоод SSL). Тиймээс backend-ийн ДОТООД хаягийг тусад нь
 *   INTERNAL_API_URL (жишээ: http://backend:3001 эсвэл http://127.0.0.1:3001)
 *   орчны хувьсагчаар өгвөл найдвартай. Байхгүй бол NEXT_PUBLIC_API_URL руу
 *   fallback хийнэ.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Хүчинтэй cookie сонгох — expired adminToken байхад user token ашиглана
  const candidates = [
    req.cookies.get("adminToken")?.value,
    req.cookies.get("token")?.value,
  ].filter((t): t is string => !!t);
  if (candidates.length === 0) {
    return new NextResponse(null, { status: 401 });
  }
  const now = Math.floor(Date.now() / 1000);
  let token = candidates[0];
  for (const t of candidates) {
    try {
      const payloadPart = t.split(".")[1];
      if (!payloadPart) continue;
      const json = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(json) as { exp?: number };
      if (typeof payload.exp === "number" && payload.exp > now) {
        token = t;
        break;
      }
    } catch {
      /* next */
    }
  }

  // Серверээс backend руу хандах хаяг — дотоод хаягийг эрхэмлэнэ
  // API_URL нь /api/auth/search-тэй ижил (deploy-д ихэвчлэн энэ л тохируулагддаг)
  const backendUrl =
    process.env.INTERNAL_API_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    console.error("[knowledge image] backend URL env is not set");
    return new NextResponse(null, { status: 500 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/medleg/${id}/image`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (err) {
    // Сервер backend руу огт хүрч чадсангүй (DNS/SSL/сүлжээ)
    console.error(
      `[knowledge image] upstream fetch failed for ${backendUrl}/medleg/${id}/image:`,
      (err as Error)?.message,
    );
    return new NextResponse(null, { status: 502 });
  }

  if (!upstream.ok) {
    console.error(
      `[knowledge image] backend returned ${upstream.status} for /medleg/${id}/image`,
    );
    return new NextResponse(null, { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();
  const mimeType = upstream.headers.get("Content-Type") ?? "image/jpeg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control":
        "private, max-age=86400, stale-while-revalidate=604800, immutable",
    },
  });
}

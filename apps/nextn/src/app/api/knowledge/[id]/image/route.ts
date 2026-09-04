import { NextRequest, NextResponse } from "next/server";
import { getApiAuth } from "@/lib/api-auth";
import { getServerBackendUrl } from "@/lib/server-backend-url";

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
  // [AUDIT] Path traversal хамгаалалт — "..%2F" маягийн id proxy-г backend-ийн
  // өөр endpoint руу чиглүүлж чаддаг байсан.
  if (!/^[\w-]+$/.test(id)) {
    return new NextResponse(null, { status: 400 });
  }
  const auth = await getApiAuth(req);
  if (!auth) {
    return new NextResponse(null, { status: 401 });
  }

  const backendUrl = getServerBackendUrl();
  if (!backendUrl) {
    console.error("[knowledge image] backend URL env is not set");
    return new NextResponse(null, { status: 500 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/medleg/${encodeURIComponent(id)}/image`, {
      headers: { Cookie: req.headers.get("cookie") ?? "" },
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

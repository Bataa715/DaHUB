import { NextRequest, NextResponse } from "next/server";
import { getApiAuth } from "@/lib/api-auth";
import { getServerBackendUrl } from "@/lib/server-backend-url";

export const dynamic = "force-dynamic";

/**
 * Профайл зургийн proxy — backend-ийн binary avatar endpoint руу нэвтрэлтийн
 * cookie-г дамжуулж, зургийг ижил origin-оор буцаана. Ингэснээр `<img src>`
 * cookie-гүйгээр (cross-origin) ажиллаж, хөтч ETag/Cache-Control-оор кэшилнэ.
 * base64-ийг жагсаалтад оруулахгүй тул employee directory зэрэг хуудас хурдан.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getApiAuth(req);
  if (!auth) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) return new NextResponse(null, { status: 400 });

  const backendUrl = getServerBackendUrl();
  if (!backendUrl) return new NextResponse(null, { status: 500 });

  const cookie = req.headers.get("cookie") ?? "";
  const ifNoneMatch = req.headers.get("if-none-match") ?? "";

  try {
    const res = await fetch(
      `${backendUrl}/users/${encodeURIComponent(id)}/avatar`,
      {
        headers: {
          cookie,
          ...(ifNoneMatch ? { "if-none-match": ifNoneMatch } : {}),
        },
        cache: "no-store",
      },
    );

    if (res.status === 304) return new NextResponse(null, { status: 304 });
    if (!res.ok) return new NextResponse(null, { status: res.status });

    const buf = Buffer.from(await res.arrayBuffer());
    const headers = new Headers();
    headers.set(
      "Content-Type",
      res.headers.get("content-type") ?? "image/jpeg",
    );
    headers.set("Cache-Control", "private, max-age=86400");
    const etag = res.headers.get("etag");
    if (etag) headers.set("ETag", etag);
    return new NextResponse(buf, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}

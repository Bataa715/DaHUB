import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for authenticated knowledge (medleg) images.
 * Reads HttpOnly token cookie and forwards to backend /medleg/:id/image.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token =
    req.cookies.get("token")?.value ?? req.cookies.get("adminToken")?.value;
  if (!token) {
    return new NextResponse(null, { status: 401 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return new NextResponse(null, { status: 500 });
  }

  const upstream = await fetch(`${backendUrl}/medleg/${id}/image`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
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

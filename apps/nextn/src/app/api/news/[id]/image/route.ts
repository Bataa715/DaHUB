import { NextRequest, NextResponse } from "next/server";

/**
 * [N-6] Proxy for authenticated news images.
 * Since <img> tags can't send HttpOnly cookies cross-origin, this server-side
 * route reads the HttpOnly token cookie (accessible on the server) and forwards
 * the request to the backend with an Authorization header.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Admin users have their JWT in "adminToken"; regular users in "token"
  const token =
    req.cookies.get("token")?.value ?? req.cookies.get("adminToken")?.value;
  if (!token) {
    return new NextResponse(null, { status: 401 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return new NextResponse(null, { status: 500 });
  }

  const upstream = await fetch(`${backendUrl}/news/${id}/image`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();
  const mimeType = upstream.headers.get("Content-Type") ?? "image/jpeg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

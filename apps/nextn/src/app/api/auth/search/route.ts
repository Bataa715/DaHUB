import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const backendUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ users: [] }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${backendUrl}/auth/search?q=${encodeURIComponent(q)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ users: [] }, { status: 502 });
  }
}

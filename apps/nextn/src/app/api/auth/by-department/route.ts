import { NextRequest, NextResponse } from "next/server";
import { getServerBackendUrl } from "@/lib/server-backend-url";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const department = req.nextUrl.searchParams.get("department");
  if (!department) {
    return NextResponse.json({ users: [] });
  }

  const backendUrl = getServerBackendUrl();
  if (!backendUrl) {
    return NextResponse.json({ users: [] }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${backendUrl}/auth/by-department?department=${encodeURIComponent(department)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ users: [] }, { status: 502 });
  }
}

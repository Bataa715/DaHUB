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
    // [PERF/429] A department's employee list is the same for everyone and
    // rarely changes. Let the browser cache a successful response briefly so
    // switching back and forth between departments (or reopening the login
    // page) doesn't re-hit the backend — this is the main relief for the 429
    // storm and for slow first loads (e.g. Incognito). Errors (incl. 429) are
    // never cached so they can recover immediately.
    const headers =
      res.status === 200
        ? { "Cache-Control": "public, max-age=180, stale-while-revalidate=300" }
        : { "Cache-Control": "no-store" };
    return NextResponse.json(data, { status: res.status, headers });
  } catch {
    return NextResponse.json({ users: [] }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getApiAuth, hasToolAccess } from "@/lib/api-auth";
import { getServerBackendUrl } from "@/lib/server-backend-url";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Monitoring Box BFF (`/bff/monitoring-*`). Prod дээр `/api/*` Nest рүү
 * явдаг тул эдгээр замыг Next дээр үлдээнэ.
 */
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const POST_ROUTES: Record<string, string> = {
  "monitoring-rpt": "/monitoring/related-party-transactions",
  "monitoring-expense-overview": "/monitoring/expense-overview",
  "monitoring-expense-payment-requests": "/monitoring/expense-payment-requests",
  "monitoring-expense-attachments": "/monitoring/expense-attachments",
  "monitoring-expense-budget-changes": "/monitoring/expense-budget-changes",
  "monitoring-expense-verification": "/monitoring/expense-verification",
  "monitoring-expense-total": "/monitoring/expense-total",
  "monitoring-expense-verification-types":
    "/monitoring/expense-verification-types",
};

function nestPath(slug: string[], method: HttpMethod): string | null {
  if (slug.length === 1) {
    const key = slug[0];
    if (key === "monitoring-expense-verification-types") {
      if (method === "GET" || method === "POST") {
        return POST_ROUTES[key];
      }
      return null;
    }
    if (method === "POST" && POST_ROUTES[key]) return POST_ROUTES[key];
    return null;
  }
  if (
    slug.length === 2 &&
    slug[0] === "monitoring-expense-verification-types" &&
    /^[\w-]+$/.test(slug[1]) &&
    (method === "PATCH" || method === "DELETE")
  ) {
    return `/monitoring/expense-verification-types/${encodeURIComponent(slug[1])}`;
  }
  return null;
}

async function proxy(req: NextRequest, method: HttpMethod, slug: string[]) {
  const nest = nestPath(slug, method);
  if (!nest) {
    return NextResponse.json(
      { message: "Хайсан мэдээлэл олдсонгүй" },
      { status: 404 },
    );
  }

  const auth = await getApiAuth(req);
  if (!auth) {
    return NextResponse.json(
      { message: "Нэвтрэх шаардлагатай" },
      { status: 401 },
    );
  }
  if (!hasToolAccess(auth, ["monitoring_box"])) {
    return NextResponse.json(
      { message: "Энэ хэрэгслийг ашиглах эрх байхгүй" },
      { status: 403 },
    );
  }

  const backendUrl = getServerBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { message: "Серверийн алдаа гарлаа" },
      { status: 500 },
    );
  }

  const needsBody = method === "POST" || method === "PATCH";
  let body: unknown;
  if (needsBody) {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: "Хүсэлт буруу байна" }, { status: 400 });
    }
  }

  const qs = method === "GET" ? req.nextUrl.search : "";
  const cookie = req.headers.get("cookie") ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);

  try {
    const upstream = await fetch(`${backendUrl}${nest}${qs}`, {
      method,
      headers: {
        ...(needsBody ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
        Cookie: cookie,
      },
      body: needsBody ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await upstream.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text || "Хайсан мэдээлэл олдсонгүй" };
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    console.error(
      `[${slug.join("/")} ${method}] upstream fetch failed:`,
      (err as Error)?.message,
    );
    return NextResponse.json(
      { message: aborted ? "Хүсэлт хугацаа хэтэрлээ" : "Серверийн алдаа гарлаа" },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

type Ctx = { params: Promise<{ slug: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, "GET", (await ctx.params).slug);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, "POST", (await ctx.params).slug);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, "PATCH", (await ctx.params).slug);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, "DELETE", (await ctx.params).slug);
}

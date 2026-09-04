import { NextRequest, NextResponse } from "next/server";
import {
  getApiAuth,
  hasToolAccess,
  isSameOriginRequest,
} from "@/lib/api-auth";
import { getServerBackendUrl } from "@/lib/server-backend-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Expense monitoring verification-types BFF (update + delete by id) —
 * Nest талд AdminGuard-аар хязгаарлагдана, энд зөвхөн session/tool-эрх
 * шалгана.
 */

async function guard(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json(
      { message: "Энэ үйлдлийг гүйцэтгэх эрх байхгүй" },
      { status: 403 },
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
  return null;
}

async function proxy(
  req: NextRequest,
  id: string,
  method: "PATCH" | "DELETE",
) {
  const denied = await guard(req);
  if (denied) return denied;

  const backendUrl = getServerBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { message: "Серверийн алдаа гарлаа" },
      { status: 500 },
    );
  }

  let body: unknown;
  if (method === "PATCH") {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "Хүсэлт буруу байна" },
        { status: 400 },
      );
    }
  }

  const cookie = req.headers.get("cookie") ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const upstream = await fetch(
      `${backendUrl}/monitoring/expense-verification-types/${encodeURIComponent(id)}`,
      {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          Accept: "application/json",
          Cookie: cookie,
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: controller.signal,
      },
    );
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
      `[monitoring-expense-verification-types/${id} ${method}] upstream fetch failed:`,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json(
      { message: "Хүсэлт буруу байна" },
      { status: 400 },
    );
  }
  return proxy(req, id, "PATCH");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json(
      { message: "Хүсэлт буруу байна" },
      { status: 400 },
    );
  }
  return proxy(req, id, "DELETE");
}

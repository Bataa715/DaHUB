import { NextRequest, NextResponse } from "next/server";
import {
  getApiAuth,
  hasToolAccess,
  isSameOriginRequest,
} from "@/lib/api-auth";
import { getServerBackendUrl } from "@/lib/server-backend-url";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Expense monitoring attachments drill-down BFF — `/api` биш тул prod
 * reverse-proxy Nest руу шууд шидэхгүй (monitoring-rpt-тэй ижил ангилал).
 * Next.js сервер INTERNAL/NEXT_PUBLIC API URL-аар backend-ийн
 * POST /monitoring/expense-attachments руу дамжуулна.
 */
export async function POST(req: NextRequest) {
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

  const backendUrl = getServerBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { message: "Серверийн алдаа гарлаа" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Хүсэлт буруу байна" }, { status: 400 });
  }

  const cookie = req.headers.get("cookie") ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);

  try {
    const upstream = await fetch(
      `${backendUrl}/monitoring/expense-attachments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify(body),
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
      "[monitoring-expense-attachments] upstream fetch failed:",
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

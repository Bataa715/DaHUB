import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/admin/login"];

// Admin routes that additionally require isSuperAdmin.
// [ACCESS] A plain admin is intentionally limited to tool-permission granting
// (/admin/tools) and changing their own password (/admin/change-password);
// every other admin surface (user management, registrations, knowledge,
// departments, homepage ethics, admin management, reports) is superadmin-only.
const SUPERADMIN_ROUTES = [
  "/admin/admins",
  "/admin/reports",
  "/admin/users",
  "/admin/registrations",
  "/admin/medleg",
  "/admin/departments",
  "/admin/homepage-ethics",
  "/admin/log",
  // [AUDIT] Эрсдэлийн жин, тайлангийн загвар, Oracle dashboard тохиргоо —
  // аудитын үр дүнд шууд нөлөөлдөг тул superadmin-only.
  "/admin/alert-box",
  "/admin/risk-indicators",
  "/admin/tailan-templates",
];

// Tool routes → required allowedTools id (any one is enough). isAdmin always passes.
const TOOL_GUARDS: Record<string, string[]> = {
  "/tools/db-access/manage": ["db_access_granter"],
  "/tools/db-access": ["db_access_requester"],
  "/tools/tailan/department": ["tailan_dept_head"],
  // [AUDIT] dept-view нь хэлтсийн бүх гишүүний тайланг харуулдаг тул
  // dept_head эрх шаардана (өмнө нь ерөнхий /tools/tailan guard-д таардаг байсан).
  "/tools/tailan/dept-view": ["tailan_dept_head"],
  "/tools/tailan/mine": ["tailan", "tailan_dept_head"],
  "/tools/tailan": ["tailan", "tailan_dept_head"],
  "/tools/sanamsargui-tuuwer": ["sanamsargui-tuuwer"],
  "/tools/pivot": ["pivot"],
  // "Эрсдэлийн үнэлгээ хийх" (edit/judgement) vs "Тайлан" (read-only report +
  // export) are split tools — the base path accepts either (landing page has
  // both cards), but /work is overridden below to require edit access only.
  "/tools/risk-assessment/work": ["risk_assessment"],
  "/tools/risk-assessment": ["risk_assessment", "risk_assessment_report"],
  "/tools/data-doc": ["data_doc"],
  "/tools/alert-box": ["alert_box"],
  "/tools/reports": ["reports"],
  "/tools/monitoring-box": ["monitoring_box"],
};

async function getTokenPayload(token: string | undefined) {
  if (!token) return null;
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("JWT_SECRET environment variable is not set");
    return null;
  }
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/**
 * [AUDIT] Хугацаа нь дууссан ч гарын үсэг нь хүчинтэй токеноос claims уншина.
 * Refresh-token-only үед tool эрхийн шалгалтыг алгасахгүйн тулд ашиглана —
 * гарын үсгийг шалгадаг тул хуурамч токеноор эрх өсгөх боломжгүй.
 */
async function getStaleTokenPayload(token: string | undefined) {
  if (!token) return null;
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      // refresh token-ий 3 цагийн амьдрах хугацааг хамарна
      clockTolerance: 3 * 60 * 60,
    });
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isAdminRoute =
    pathname.startsWith("/admin") && pathname !== "/admin/login";

  // Admin routes use adminToken; regular routes use token
  const adminToken = request.cookies.get("adminToken")?.value;
  const userToken = request.cookies.get("token")?.value;

  const adminPayload = await getTokenPayload(adminToken);
  const userPayload = await getTokenPayload(userToken);

  const isAdminAuth =
    !!adminPayload &&
    (adminPayload["isAdmin"] === true || adminPayload["isAdmin"] === 1);
  const isUserAuth = !!userPayload && !userPayload["isAdmin"];

  // If the access token is expired but a refresh token exists, let the
  // client through so AuthContext can silently refresh it on mount.
  const hasRefreshToken = !!request.cookies.get("refreshToken")?.value;
  const hasAdminRefreshToken =
    !!request.cookies.get("adminRefreshToken")?.value;

  //  Admin routes
  if (isAdminRoute) {
    if (!isAdminAuth && !hasAdminRefreshToken) {
      const response = NextResponse.redirect(
        new URL("/admin/login", request.url),
      );
      response.cookies.delete("adminToken");
      response.cookies.delete("adminUser");
      return response;
    }
    // Certain admin sub-routes are superadmin-only
    const requiresSuperAdmin = SUPERADMIN_ROUTES.some((r) =>
      pathname.startsWith(r),
    );
    if (requiresSuperAdmin && adminPayload?.["isSuperAdmin"] !== true) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  //  Protected non-admin routes
  // API routes are excluded from login redirect — they return JSON and handle
  // auth errors themselves (or proxy to backend which enforces its own guards).
  if (
    !isUserAuth &&
    !hasRefreshToken &&
    !isPublicRoute &&
    !isAdminRoute &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/bff") &&
    !pathname.startsWith("/team-gallery")
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Legacy tools grid — sidebar is primary nav
  if (pathname === "/tools") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  //  Tool route permission check
  // [AUDIT] Токен хугацаа дууссан ч refreshToken-той нэвтэрч буй үед
  // (silent refresh pass-through) эрхийн шалгалтыг алгасахгүй — хуучирсан
  // токеноос гарын үсэг шалгасан claims-ийг ашиглана.
  const toolCheckPayload =
    userPayload ??
    (hasRefreshToken && pathname.startsWith("/tools/")
      ? await getStaleTokenPayload(userToken)
      : null);
  if (
    toolCheckPayload &&
    !toolCheckPayload["isAdmin"] &&
    pathname.startsWith("/tools/")
  ) {
    // Find the most-specific matching guard (longest prefix)
    const matchedPath = Object.keys(TOOL_GUARDS)
      .filter((p) => pathname === p || pathname.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];

    if (matchedPath) {
      const requiredTools = TOOL_GUARDS[matchedPath];
      const isSuper =
        toolCheckPayload["isAdmin"] === true ||
        toolCheckPayload["isAdmin"] === 1 ||
        toolCheckPayload["isSuperAdmin"] === true ||
        toolCheckPayload["isSuperAdmin"] === 1;

      if (!isSuper) {
        // JWT claim array эсвэл JSON string байж болно
        const rawTools = toolCheckPayload["allowedTools"];
        let userTools: string[] = [];
        if (Array.isArray(rawTools)) userTools = rawTools.map(String);
        else if (typeof rawTools === "string") {
          try {
            const parsed = JSON.parse(rawTools);
            userTools = Array.isArray(parsed) ? parsed.map(String) : [];
          } catch {
            userTools = [];
          }
        }
        const hasAccess = requiredTools.some((t) => userTools.includes(t));
        if (!hasAccess) {
          // "/tools" grid is no longer the primary nav surface (sidebar is) —
          // send unauthorized tool visits back to the home page instead.
          return NextResponse.redirect(new URL("/", request.url));
        }
      }
    }
  }

  //  Redirect already-authenticated users away from login pages
  if (pathname === "/login" && isUserAuth) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname === "/admin/login" && isAdminAuth) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|sounds|team|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)).*)",
  ],
};

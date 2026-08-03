import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/admin/login"];

// Admin routes that additionally require isSuperAdmin
const SUPERADMIN_ROUTES = ["/admin/admins", "/admin/reports"];

// Tool routes → required allowedTools id (any one is enough). isAdmin always passes.
const TOOL_GUARDS: Record<string, string[]> = {
  "/tools/db-access/manage": ["db_access_granter"],
  "/tools/db-access": ["db_access_requester"],
  "/tools/tailan/department": ["tailan_dept_head"],
  "/tools/tailan/mine": ["tailan", "tailan_dept_head"],
  "/tools/tailan": ["tailan", "tailan_dept_head"],
  "/tools/sanamsargui-tuuwer": ["sanamsargui-tuuwer"],
  "/tools/pivot": ["pivot"],
  "/tools/risk-assessment": ["risk_assessment"],
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

// [MED-4] Per-request nonce-based CSP for script-src, replacing the previous
// static 'unsafe-inline' (which lets ANY injected inline <script> execute,
// defeating CSP's protection against script-injection XSS). Next.js
// automatically applies this nonce to its own injected script tags
// (webpack runtime / hydration payload) once it sees the nonce in the CSP
// header, so no changes are needed in individual pages/components.
// 'unsafe-inline' is kept as a fallback token for pre-CSP3 browsers only —
// per the CSP spec, browsers that understand nonces ignore 'unsafe-inline'
// when a nonce is present, so this does not weaken protection in practice.
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    isDev
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: http://localhost:3001 https://placehold.co https://images.unsplash.com https://picsum.photos https://i.pinimg.com https://api.dicebear.com https://cdn.simpleicons.org https://api.qrserver.com",
    "font-src 'self' data:",
    "connect-src 'self' " +
      (process.env.NEXT_PUBLIC_API_URL ?? "") +
      (isDev ? " ws://localhost:* wss://localhost:*" : "") +
      " https://cdn.simpleicons.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Forward the nonce to the app (readable via `headers()` in Server
  // Components if a page ever needs to nonce its own inline script) and
  // apply the same CSP as a response header so the browser enforces it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const withCsp = <T extends NextResponse>(response: T): T => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

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
      return withCsp(response);
    }
    // Certain admin sub-routes are superadmin-only
    const requiresSuperAdmin = SUPERADMIN_ROUTES.some((r) =>
      pathname.startsWith(r),
    );
    if (requiresSuperAdmin && adminPayload?.["isSuperAdmin"] !== true) {
      return withCsp(NextResponse.redirect(new URL("/admin", request.url)));
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
    !pathname.startsWith("/api/")
  ) {
    return withCsp(NextResponse.redirect(new URL("/login", request.url)));
  }

  // Legacy tools grid — sidebar is primary nav
  if (pathname === "/tools") {
    return withCsp(NextResponse.redirect(new URL("/", request.url)));
  }

  //  Tool route permission check
  if (isUserAuth && pathname.startsWith("/tools/")) {
    // Find the most-specific matching guard (longest prefix)
    const matchedPath = Object.keys(TOOL_GUARDS)
      .filter((p) => pathname === p || pathname.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];

    if (matchedPath) {
      const requiredTools = TOOL_GUARDS[matchedPath];
      const isSuper =
        userPayload!["isAdmin"] === true ||
        userPayload!["isAdmin"] === 1 ||
        userPayload!["isSuperAdmin"] === true ||
        userPayload!["isSuperAdmin"] === 1;

      if (!isSuper) {
        // JWT claim array эсвэл JSON string байж болно
        const rawTools = userPayload!["allowedTools"];
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
          return withCsp(NextResponse.redirect(new URL("/", request.url)));
        }
      }
    }
  }

  //  Redirect already-authenticated users away from login pages
  if (pathname === "/login" && isUserAuth) {
    return withCsp(NextResponse.redirect(new URL("/", request.url)));
  }
  if (pathname === "/admin/login" && isAdminAuth) {
    return withCsp(NextResponse.redirect(new URL("/admin", request.url)));
  }

  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|sounds|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/admin/login"];

// Tool routes → required allowedTools id (any one is enough). isAdmin always passes.
const TOOL_GUARDS: Record<string, string[]> = {
  "/tools/db-access/manage": ["db_access_granter"],
  "/tools/db-access": ["db_access_requester"],
  "/tools/tailan/department": ["tailan_dept_head"],
  "/tools/tailan/mine": ["tailan", "tailan_dept_head"],
  "/tools/tailan": ["tailan", "tailan_dept_head"],
  "/tools/fitness": ["fitness"],
  "/tools/todo": ["todo"],
  "/tools/sanamsargui-tuuwer": ["sanamsargui-tuuwer"],
  "/tools/pivot": ["pivot"],
  "/tools/report": ["report"],
};

async function getTokenPayload(token: string | undefined) {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
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

  //  Admin routes
  if (isAdminRoute) {
    if (!isAdminAuth) {
      const response = NextResponse.redirect(
        new URL("/admin/login", request.url),
      );
      response.cookies.delete("adminToken");
      response.cookies.delete("adminUser");
      return response;
    }
  }

  //  Protected non-admin routes
  if (!isUserAuth && !isPublicRoute && !isAdminRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
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
        userPayload!["isSuperAdmin"] === true;

      if (!isSuper) {
        const userTools = (userPayload!["allowedTools"] as string[]) ?? [];
        const hasAccess = requiredTools.some((t) => userTools.includes(t));
        if (!hasAccess) {
          return NextResponse.redirect(new URL("/tools", request.url));
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
    "/((?!_next/static|_next/image|favicon.ico|images|sounds|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};

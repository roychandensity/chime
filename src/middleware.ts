import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for cron jobs (they use CRON_SECRET)
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  const protectedPaths = [
    "/dashboard",
    "/api/spaces",
    "/api/sessions",
    "/api/desk-sessions",
    "/api/saturation",
    "/api/availability",
    "/api/group-size",
    "/api/export",
  ];

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token || !(await verifySessionToken(token))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/spaces/:path*",
    "/api/sessions/:path*",
    "/api/desk-sessions/:path*",
    "/api/saturation/:path*",
    "/api/availability/:path*",
    "/api/group-size/:path*",
    "/api/export/:path*",
    "/api/cron/:path*",
  ],
};

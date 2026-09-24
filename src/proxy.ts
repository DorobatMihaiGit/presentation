import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // Optimistic redirect only (no DB call). A forged or expired cookie gets
    // through here and is rejected by requireAdmin() in the admin layout,
    // pages and every server action (CVE-2025-29927).
    const isLogin =
      pathname === "/admin/login" || pathname.startsWith("/admin/login/");
    if (!isLogin && !getSessionCookie(request)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  return intl(request);
}

export const config = {
  // Everything except API routes, Next/Vercel internals and files with an extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};

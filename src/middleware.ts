import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/firebase/config";

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/app", "/onboarding"];
/** Auth routes a signed-in user should be bounced away from. */
const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Coarse route protection based on presence of the Firebase session cookie.
 * The cookie is NOT cryptographically verified here — firebase-admin requires
 * the Node.js runtime, and middleware runs on Edge. Server components/route
 * handlers verify it for real via getCurrentUser(); this only avoids obvious
 * unauthenticated navigation and keeps auth pages out of signed-in users' way.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return redirectTo(request, "/login");
  }

  if (hasSession && AUTH_ROUTES.includes(pathname)) {
    return redirectTo(request, "/app");
  }

  return NextResponse.next();
}

function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

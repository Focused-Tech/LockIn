import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/firebase/config";

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/app", "/onboarding"];

/**
 * Coarse route protection based on presence of the Firebase session cookie.
 * The cookie is NOT cryptographically verified here — firebase-admin requires
 * the Node.js runtime, and middleware runs on Edge. Server components/route
 * handlers verify it for real via getCurrentUser(); this only avoids obvious
 * unauthenticated navigation to protected pages.
 *
 * NOTE: we deliberately do NOT bounce signed-in users away from /login,/signup
 * here. That was presence-based, and a present-but-invalid cookie created an
 * infinite loop (server bounced /app->/login while middleware bounced
 * /login->/app). The auth-route bounce now lives in the login/signup server
 * components, which verify the session for real before redirecting to /app.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return redirectTo(request, "/login");
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

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { logSessionActivityFailure, recordSessionActivity } from "@/lib/session-activity";

const publicRoutes = ["/login"];
const authRoutes = ["/login"];

// Both cookie names Auth.js uses (secure prefix appears behind HTTPS).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

// Phase 19: the auth() wrapper in src/lib/auth.ts has already run the
// server-side liveness gate (idle window, user existence, role freshness)
// before this callback executes — req.auth is null for expired sessions.
export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session;

  // Allow public routes without auth
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Protect all other routes
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    // A cookie that the server rejected means the session ENDED (idle or
    // absolute expiry, deleted user) rather than "never signed in" — let the
    // login page say so. The reason string carries no sensitive detail.
    if (SESSION_COOKIES.some((name) => req.cookies.has(name))) {
      loginUrl.searchParams.set("error", "SessionExpired");
    }
    return NextResponse.redirect(loginUrl);
  }

  // Meaningful activity: a real page/RSC navigation by an authenticated
  // user. Router prefetches are passive (no user action) and are skipped;
  // background data polling never reaches this middleware because the
  // matcher excludes /api. Writes are throttled inside the store, so this
  // costs at most one UPDATE per session per throttle window.
  if (session.sessionId && !req.headers.get("next-router-prefetch")) {
    try {
      await recordSessionActivity({
        sid: session.sessionId,
        userId: session.user.id,
      });
    } catch (error) {
      // Best-effort: expiry is decided by the check, not this write — if it
      // fails, a later navigation or input ping records instead.
      logSessionActivityFailure("record:navigation", error);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all dashboard routes
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

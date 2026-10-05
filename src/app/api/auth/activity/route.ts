import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  logSessionActivityFailure,
  recordSessionActivity,
} from "@/lib/session-activity";

export const dynamic = "force-dynamic";

/**
 * Phase 19: explicit activity ping.
 *
 * The client posts here ONLY in response to real user input (keydown,
 * pointer, wheel, touch — see SessionActivityMonitor), throttled client-side
 * and again server-side. The server records `now()` itself: the client
 * sends no timestamp, so a ping can neither backdate nor extend anything
 * beyond the next throttle window, and it can never extend the absolute
 * lifetime (enforced independently from the token's authAt).
 *
 * A ping on an already-expired session returns 401 from the auth() gate
 * BEFORE any write, so an expired session cannot resurrect itself.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !session.sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Defense in depth: reject cross-origin pings outright. The session cookie
  // is SameSite=Lax (never sent on cross-site POSTs), and Auth.js's CSRF
  // token does not apply to this route — an Origin check closes the gap for
  // same-site subdomain confusion at negligible cost.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const expected = new URL(
        process.env.AUTH_URL ?? request.url
      ).origin;
      if (new URL(origin).origin !== expected) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await recordSessionActivity({
      sid: session.sessionId,
      userId: session.user.id,
    });
  } catch (error) {
    // The liveness check inside auth() already proved the session is live;
    // a failed recording only loses this ping (the next one retries), so
    // log it and still acknowledge — availability over marginal precision.
    logSessionActivityFailure("record:ping", error);
  }
  return new NextResponse(null, { status: 204 });
}

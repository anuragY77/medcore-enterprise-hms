import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createPgRateLimitStore,
  describeLoginAttempt,
  guardLoginAttempt,
  observeLoginAttempt,
} from "@/lib/login-rate-limit";

// IMPORTANT: Force dynamic to prevent Data Cache from caching session responses.
// Without this, the first user's session would be cached and served to all users.
export const dynamic = "force-dynamic";

// Phase 17: every credentials sign-in attempt passes through the PostgreSQL-
// backed brute-force guard before NextAuth runs, and its outcome is observed
// afterwards (failed passwords count, successes clear, unrelated auth errors
// are ignored). The attempt (IP + email) is parsed ONCE here because NextAuth
// consumes the request body — a second parse after the handler would see an
// empty form. Other auth endpoints (session, csrf, signout) are untouched.
export async function GET(request: NextRequest) {
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const attempt = await describeLoginAttempt(request);
  if (!attempt) {
    return handlers.POST(request);
  }

  const store = createPgRateLimitStore(db);
  const guarded = await guardLoginAttempt(attempt, store);
  if (guarded) return guarded;

  const response = await handlers.POST(request);
  await observeLoginAttempt(attempt, response, store);
  return response;
}

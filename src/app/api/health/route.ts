import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db } from "@/lib/db";
import { getAuditFailureCount } from "@/lib/audit";

// Phase 32: minimal operational probe.
//
// Liveness: the process answered the request — always HTTP 200 while the
// server is serving. Readiness: `checks.database` is "ok" only when a real
// `SELECT 1` round-trips; load balancers and supervisors should gate on that
// field, not on the HTTP status alone. The response never contains
// connection strings, secrets, stack traces, or row counts — only these
// three fields.
//
// `auditWriteFailures` (in-process counter of best-effort audit writes that
// failed after a clinical commit) is exposed ONLY to sessions holding
// audit:read (SECURITY/ADMIN — the existing audit-permission keys; no matrix
// change): it is an operational signal, not public surface. It resets on
// process restart by design.
export async function GET() {
  let database: "ok" | "down" = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    database = "down";
  }

  const body: {
    status: "ok";
    checks: { database: "ok" | "down" };
    auditWriteFailures?: number;
  } = {
    status: "ok",
    checks: { database },
  };

  const session = await auth().catch(() => null);
  if (session && hasPermission(session.user.role, "audit:read")) {
    body.auditWriteFailures = getAuditFailureCount();
  }

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

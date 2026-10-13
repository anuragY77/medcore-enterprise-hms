import { db, auditLogs } from "@/lib/db";
import type { Db, Tx } from "@/lib/db/seed/types";

export interface AuditEventInput {
  actorId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  severity?: string | null;
  category?: string | null;
  success?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

// Phase 32: in-process counter of best-effort audit-write failures. Not a
// durable metric — it resets on restart — but it gives operators and the
// health endpoint a live signal that clinical commits are going out without
// their audit rows. Transactional paths (insertAuditRow) never touch this
// counter: their failures roll the clinical change back instead.
let auditFailureCount = 0;

export function getAuditFailureCount(): number {
  return auditFailureCount;
}

/** Test-only reset so unit tests can assert counter deltas deterministically. */
export function resetAuditFailureCountForTests(): void {
  auditFailureCount = 0;
}

/**
 * Insert an audit row using the given executor (root handle or an open
 * transaction). THROWS on failure — call it inside the clinical transaction
 * so the audit record and the clinical change commit or roll back together
 * (Phase 32 atomic-audit guarantee: a success response implies both).
 */
export async function insertAuditRow(
  exec: Db | Tx,
  event: AuditEventInput
): Promise<void> {
  await exec.insert(auditLogs).values({
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    severity: event.severity ?? null,
    category: event.category ?? null,
    success: event.success ?? null,
    metadata: event.metadata ?? null,
  });
}

/**
 * Best-effort audit insert on the root handle for contexts that have no
 * clinical transaction to join (login outcomes, simple non-transactional
 * creates/updates). Never throws — an audit failure must not break the
 * primary operation — but it increments a failure counter and logs a
 * structured, PHI-free line so repeated failures stay observable.
 */
export async function recordAudit(event: AuditEventInput): Promise<void> {
  try {
    await insertAuditRow(db, event);
  } catch (error) {
    auditFailureCount += 1;
    console.error(
      "Failed to record audit event",
      { action: event.action, entityType: event.entityType },
      error instanceof Error ? error.message : error
    );
  }
}

import { db, auditLogs } from "@/lib/db";

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

/**
 * Insert an audit event into audit_logs.
 * Never throws — audit failures must not break the primary business operation.
 */
export async function recordAudit(event: AuditEventInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      severity: event.severity ?? null,
      category: event.category ?? null,
      success: event.success ?? null,
      metadata: event.metadata ?? null,
    });
  } catch (error) {
    console.error(
      "Failed to record audit event",
      { action: event.action, entityType: event.entityType },
      error instanceof Error ? error.message : error
    );
  }
}

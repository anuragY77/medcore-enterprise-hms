import { sql } from "drizzle-orm";
import { db, notifications, users, staff } from "@/lib/db";
import { hasPermission, type Role } from "@/types/auth";
import type { NOTIFICATION_TYPES } from "@/lib/validations/notification";

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationEventInput {
  recipientIds: string[];
  title: string;
  message: string;
  type: NotificationType;
  action?: string | null;
}

/**
 * Insert notifications for the given recipients.
 * Never throws — notification failures must not break the primary business operation.
 * Deduplicates recipient ids and skips empty input.
 * Returns the number of notifications inserted.
 */
export async function recordNotifications(input: NotificationEventInput): Promise<number> {
  try {
    const recipientIds = [...new Set(input.recipientIds)].filter(Boolean);
    if (recipientIds.length === 0) {
      return 0;
    }

    const title = input.title.slice(0, 200);
    const message = input.message.slice(0, 2000);
    const action = input.action ? input.action.slice(0, 500) : null;

    await db
      .insert(notifications)
      .values(
        recipientIds.map((recipientId) => ({
          recipientId,
          title,
          message,
          type: input.type,
          action,
        }))
      );

    return recipientIds.length;
  } catch (error) {
    console.error(
      "Failed to record notification",
      { type: input.type, recipients: input.recipientIds.length },
      error instanceof Error ? error.message : error
    );
    return 0;
  }
}

async function filterReadable(rows: { id: string; role: string }[]): Promise<string[]> {
  return rows
    .filter((row) => hasPermission(row.role as Role, "notifications:read"))
    .map((row) => row.id);
}

/**
 * Resolve a display name (e.g. "Dr. James Wilson") to at most one user id.
 * Mapping chain: exact case-insensitive users.name match first, then
 * staff name -> staff.email -> users.email. A unique match is required;
 * zero or ambiguous matches yield an empty result (no notification emitted
 * because no safe recipient mapping exists).
 */
export async function resolveUserByName(displayName: string | null | undefined): Promise<string[]> {
  const name = (displayName ?? "").trim();
  if (!name) {
    return [];
  }

  try {
    const byName = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`lower(${users.name}) = lower(${name})`);

    const readable = await filterReadable(byName);
    if (readable.length === 1) {
      return readable;
    }
    if (readable.length > 1) {
      return [];
    }

    const staffRows = await db
      .select({ email: staff.email })
      .from(staff)
      .where(sql`lower(${staff.firstName} || ' ' || ${staff.lastName}) = lower(${name})`)
      .limit(2);

    if (staffRows.length !== 1 || !staffRows[0].email) {
      return [];
    }

    const byEmail = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${staffRows[0].email})`);

    const mapped = await filterReadable(byEmail);
    return mapped.length === 1 ? mapped : [];
  } catch (error) {
    console.error(
      "Failed to resolve notification recipient by name",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Resolve every user holding the given role that can read notifications.
 */
export async function resolveUsersByRole(role: Role): Promise<string[]> {
  try {
    if (!hasPermission(role, "notifications:read")) {
      return [];
    }
    const rows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`${users.role} = ${role}`);
    return await filterReadable(rows);
  } catch (error) {
    console.error(
      "Failed to resolve notification recipients by role",
      { role },
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Resolve users holding the given role within the given department
 * (case-insensitive). Used to derive ward nurses for bed events.
 */
export async function resolveUsersByDepartmentRole(
  role: Role,
  department: string | null | undefined
): Promise<string[]> {
  const dept = (department ?? "").trim();
  if (!dept) {
    return [];
  }

  try {
    if (!hasPermission(role, "notifications:read")) {
      return [];
    }
    const rows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`${users.role} = ${role} AND lower(${users.department}) = lower(${dept})`);
    return await filterReadable(rows);
  } catch (error) {
    console.error(
      "Failed to resolve notification recipients by department",
      { role, department: dept },
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

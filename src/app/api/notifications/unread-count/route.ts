import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, notifications } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "notifications:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, session.user.id),
          eq(notifications.isRead, false)
        )
      );

    const count = Number(result?.count ?? 0);

    return NextResponse.json({
      data: { count: Number.isFinite(count) && count > 0 ? count : 0 },
    });
  } catch (error) {
    console.error("Failed to count unread notifications:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

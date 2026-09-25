import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, notifications } from "@/lib/db";
import { notificationIdSchema } from "@/lib/validations/notification";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "notifications:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const parsedId = notificationIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedId.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, parsedId.data),
          eq(notifications.recipientId, session.user.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

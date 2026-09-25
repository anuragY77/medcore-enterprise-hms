import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, notifications, users } from "@/lib/db";
import { notificationListQuerySchema, createNotificationSchema } from "@/lib/validations/notification";
import { recordAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "notifications:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const raw: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (value !== "") {
        raw[key] = value;
      }
    });

    const parsed = notificationListQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { read, type, page, pageSize } = parsed.data;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(notifications.recipientId, session.user.id)];

    if (read !== undefined) {
      conditions.push(eq(notifications.isRead, read === "true"));
    }

    if (type) {
      conditions.push(eq(notifications.type, type));
    }

    const whereClause = and(...conditions);

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(whereClause),
      db
        .select({
          id: notifications.id,
          recipientId: notifications.recipientId,
          title: notifications.title,
          message: notifications.message,
          type: notifications.type,
          isRead: notifications.isRead,
          readAt: notifications.readAt,
          action: notifications.action,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "notifications:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createNotificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { recipientId, title, message, type, action } = parsed.data;

    const [recipient] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const [notification] = await db
      .insert(notifications)
      .values({
        recipientId,
        title,
        message,
        type,
        action: action ?? null,
      })
      .returning();

    await recordAudit({
      actorId: session.user.id,
      action: "notification.create",
      entityType: "notification",
      entityId: notification.id,
      severity: "INFO",
      category: "notifications",
      success: true,
      metadata: {
        recipientId: notification.recipientId,
        type: notification.type,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq, or, ilike, sql, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, auditLogs, users } from "@/lib/db";
import { auditLogQuerySchema } from "@/lib/validations/audit-log";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "audit:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const raw: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (value !== "") {
        raw[key] = value;
      }
    });

    const parsed = auditLogQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      search,
      action,
      actorId,
      entityType,
      entityId,
      severity,
      category,
      success,
      from,
      to,
      page,
      pageSize,
    } = parsed.data;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(auditLogs.action, `%${search}%`),
          ilike(auditLogs.entityType, `%${search}%`),
          ilike(auditLogs.category, `%${search}%`),
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      );
    }

    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    if (actorId) {
      conditions.push(eq(auditLogs.actorId, actorId));
    }

    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }

    if (entityId) {
      conditions.push(eq(auditLogs.entityId, entityId));
    }

    if (severity) {
      conditions.push(eq(auditLogs.severity, severity));
    }

    if (category) {
      conditions.push(eq(auditLogs.category, category));
    }

    if (success !== undefined) {
      conditions.push(eq(auditLogs.success, success === "true"));
    }

    if (from) {
      conditions.push(gte(auditLogs.timestamp, new Date(from)));
    }

    if (to) {
      conditions.push(lte(auditLogs.timestamp, new Date(to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorId, users.id))
        .where(whereClause),
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          timestamp: auditLogs.timestamp,
          severity: auditLogs.severity,
          category: auditLogs.category,
          success: auditLogs.success,
          metadata: auditLogs.metadata,
          actorId: users.id,
          actorName: users.name,
          actorEmail: users.email,
          actorRole: users.role,
          actorDepartment: users.department,
          actorAvatar: users.avatar,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorId, users.id))
        .where(whereClause)
        .orderBy(sql`${auditLogs.timestamp} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const data = rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      timestamp: row.timestamp,
      severity: row.severity,
      category: row.category,
      success: row.success,
      metadata: row.metadata,
      actor: row.actorId
        ? {
            id: row.actorId,
            name: row.actorName,
            email: row.actorEmail,
            role: row.actorRole,
            department: row.actorDepartment,
            avatar: row.actorAvatar,
          }
        : null,
    }));

    return NextResponse.json({
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, users } from "@/lib/db";
import { updateUserSchema, userIdSchema } from "@/lib/validations/user";
import { recordAudit } from "@/lib/audit";

const SAFE_USER_FIELDS = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  department: users.department,
  avatar: users.avatar,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "users:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [user] = await db
      .select(SAFE_USER_FIELDS)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "users:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const parsedId = userIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedId.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const fields = parsed.data;
    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select(SAFE_USER_FIELDS)
      .from(users)
      .where(eq(users.id, parsedId.data))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const normalizedEmail =
      fields.email !== undefined ? fields.email.toLowerCase() : undefined;

    if (normalizedEmail !== undefined && normalizedEmail !== existing.email) {
      const [duplicate] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, normalizedEmail), ne(users.id, parsedId.data)))
        .limit(1);

      if (duplicate) {
        return NextResponse.json(
          { error: "A user with this email already exists." },
          { status: 409 }
        );
      }
    }

    const changedFields: string[] = [];
    if (fields.name !== undefined && fields.name !== existing.name) {
      changedFields.push("name");
    }
    if (normalizedEmail !== undefined && normalizedEmail !== existing.email) {
      changedFields.push("email");
    }
    if (fields.role !== undefined && fields.role !== existing.role) {
      changedFields.push("role");
    }
    if (fields.department !== undefined && fields.department !== existing.department) {
      changedFields.push("department");
    }
    if (
      fields.avatar !== undefined &&
      (fields.avatar || null) !== (existing.avatar ?? null)
    ) {
      changedFields.push("avatar");
    }

    const updateData: Record<string, unknown> = {};
    if (fields.name !== undefined) updateData.name = fields.name;
    if (normalizedEmail !== undefined) updateData.email = normalizedEmail;
    if (fields.role !== undefined) updateData.role = fields.role;
    if (fields.department !== undefined) updateData.department = fields.department;
    if (fields.avatar !== undefined) updateData.avatar = fields.avatar || null;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, parsedId.data))
      .returning(SAFE_USER_FIELDS);

    await recordAudit({
      actorId: session.user.id,
      action: "user.update",
      entityType: "user",
      entityId: parsedId.data,
      severity: "INFO",
      category: "users",
      success: true,
      metadata: changedFields.length > 0 ? { changedFields } : null,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      );
    }
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "users:delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const parsedId = userIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedId.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsedId.data === session.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 409 }
      );
    }

    const [existing] = await db
      .select({ id: users.id, role: users.role, department: users.department })
      .from(users)
      .where(eq(users.id, parsedId.data))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let deleted: { id: string } | undefined;
    try {
      [deleted] = await db
        .delete(users)
        .where(eq(users.id, parsedId.data))
        .returning({ id: users.id });
    } catch (error) {
      const code = pgErrorCode(error);
      if (code === "23503" || code === "23001") {
        return NextResponse.json(
          { error: "This user cannot be deleted because related records exist." },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "user.delete",
      entityType: "user",
      entityId: parsedId.data,
      severity: "INFO",
      category: "users",
      success: true,
      metadata: { role: existing.role, department: existing.department },
    });

    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

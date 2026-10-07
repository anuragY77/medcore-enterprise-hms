import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, staff } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { staffSchema } from "@/lib/validations/staff";
import { recordAudit } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "staff:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [staffMember] = await db
      .select()
      .from(staff)
      .where(eq(staff.id, id))
      .limit(1);

    if (!staffMember) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json(staffMember);
  } catch (error) {
    console.error("Failed to fetch staff:", error);
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
    if (!hasPermission(session.user.role, "staff:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(staff)
      .where(eq(staff.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { body: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
    const parsed = staffSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedStaff] = await db
      .update(staff)
      .set({
        ...parsed.data,
        specialization: parsed.data.specialization ?? undefined,
        qualification: parsed.data.qualification ?? undefined,
        experience: parsed.data.experience ?? undefined,
        joiningDate: parsed.data.joiningDate ? new Date(parsed.data.joiningDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, id))
      .returning();

    await recordAudit({
      actorId: session.user.id,
      action: "staff.update",
      entityType: "staff",
      entityId: existing.id,
      severity: "INFO",
      category: "staff",
      success: true,
      metadata: {
        staffCode: existing.staffId,
        role: updatedStaff?.role ?? existing.role,
        department: updatedStaff?.department ?? existing.department,
        statusFrom: existing.status,
        statusTo: updatedStaff?.status ?? existing.status,
      },
    });

    return NextResponse.json(updatedStaff);
  } catch (error) {
    console.error("Failed to update staff:", error);
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
    if (!hasPermission(session.user.role, "staff:delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [deletedStaff] = await db
      .delete(staff)
      .where(eq(staff.id, id))
      .returning();

    if (!deletedStaff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "staff.delete",
      entityType: "staff",
      entityId: deletedStaff.id,
      severity: "WARNING",
      category: "staff",
      success: true,
      metadata: {
        staffCode: deletedStaff.staffId,
        role: deletedStaff.role,
        department: deletedStaff.department,
        status: deletedStaff.status,
      },
    });

    return NextResponse.json({ message: "Staff deleted" });
  } catch (error) {
    console.error("Failed to delete staff:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

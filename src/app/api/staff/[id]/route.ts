import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, staff } from "@/lib/db";
import { staffSchema } from "@/lib/validations/staff";

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

    const [existing] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const body = await request.json();
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

    const [deletedStaff] = await db
      .delete(staff)
      .where(eq(staff.id, id))
      .returning();

    if (!deletedStaff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Staff deleted" });
  } catch (error) {
    console.error("Failed to delete staff:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

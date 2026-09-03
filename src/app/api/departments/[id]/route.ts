import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, departments } from "@/lib/db";
import { departmentSchema } from "@/lib/validations/department";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "departments:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("Failed to fetch department:", error);
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
    if (!hasPermission(session.user.role, "departments:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = departmentSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedDepartment] = await db
      .update(departments)
      .set({
        ...parsed.data,
        name: parsed.data.name ?? undefined,
        description: parsed.data.description ?? undefined,
        headDoctor: parsed.data.headDoctor ?? undefined,
        phone: parsed.data.phone ?? undefined,
        location: parsed.data.location ?? undefined,
        totalBeds: parsed.data.totalBeds ?? undefined,
        status: parsed.data.status ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(departments.id, id))
      .returning();

    return NextResponse.json(updatedDepartment);
  } catch (error) {
    console.error("Failed to update department:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

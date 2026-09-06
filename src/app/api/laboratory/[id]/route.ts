import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, labTests } from "@/lib/db";
import { labTestSchema } from "@/lib/validations/laboratory";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "laboratory:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [test] = await db
      .select()
      .from(labTests)
      .where(eq(labTests.id, id))
      .limit(1);

    if (!test) {
      return NextResponse.json({ error: "Lab test not found" }, { status: 404 });
    }

    return NextResponse.json(test);
  } catch (error) {
    console.error("Failed to fetch lab test:", error);
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
    if (!hasPermission(session.user.role, "laboratory:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: labTests.id })
      .from(labTests)
      .where(eq(labTests.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Lab test not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = labTestSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedTest] = await db
      .update(labTests)
      .set({
        ...parsed.data,
        patientId: parsed.data.patientId ?? undefined,
        consultationId: parsed.data.consultationId ?? undefined,
        testName: parsed.data.testName ?? undefined,
        category: parsed.data.category ?? undefined,
        orderedBy: parsed.data.orderedBy ?? undefined,
        status: parsed.data.status ?? undefined,
        result: parsed.data.result ?? undefined,
        notes: parsed.data.notes ?? undefined,
        testDate: parsed.data.testDate ? new Date(parsed.data.testDate) : undefined,
        completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(labTests.id, id))
      .returning();

    return NextResponse.json(updatedTest);
  } catch (error) {
    console.error("Failed to update lab test:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, labTests } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { labTestUpdateSchema } from "@/lib/validations/laboratory";
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
    if (!hasPermission(session.user.role, "laboratory:read")) {
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

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = labTestUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(labTests)
      .where(eq(labTests.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Lab test not found" }, { status: 404 });
    }

    const raw = body as Record<string, unknown>;

    if (raw.patientId !== undefined && raw.patientId !== existing.patientId) {
      return NextResponse.json(
        { error: "Lab test patient cannot be reassigned" },
        { status: 409 }
      );
    }

    if (
      raw.consultationId !== undefined &&
      (raw.consultationId || null) !== (existing.consultationId ?? null)
    ) {
      return NextResponse.json(
        { error: "Lab test consultation cannot be changed" },
        { status: 409 }
      );
    }

    if (raw.status !== undefined && raw.status !== existing.status) {
      return NextResponse.json(
        { error: "Lab test status is managed by the laboratory workflow" },
        { status: 409 }
      );
    }

    if (
      raw.result !== undefined &&
      (raw.result ?? null) !== (existing.result ?? null)
    ) {
      return NextResponse.json(
        { error: "Lab test results are managed by the laboratory workflow" },
        { status: 409 }
      );
    }

    const existingCompletedAt = existing.completedAt
      ? existing.completedAt.getTime()
      : null;
    let bodyCompletedAt: number | null = null;
    if (raw.completedAt !== undefined && raw.completedAt !== null && raw.completedAt !== "") {
      bodyCompletedAt = new Date(String(raw.completedAt)).getTime();
    }
    if (raw.completedAt !== undefined && bodyCompletedAt !== existingCompletedAt) {
      return NextResponse.json(
        { error: "Lab test completion time is managed by the laboratory workflow" },
        { status: 409 }
      );
    }

    const [updatedTest] = await db
      .update(labTests)
      .set({
        testName: parsed.data.testName ?? undefined,
        category: parsed.data.category ?? undefined,
        orderedBy: parsed.data.orderedBy ?? undefined,
        notes: parsed.data.notes ?? undefined,
        testDate: parsed.data.testDate ? new Date(parsed.data.testDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(labTests.id, id))
      .returning();

    await recordAudit({
      actorId: session.user.id,
      action: "laboratory.test.update",
      entityType: "lab_test",
      entityId: updatedTest.id,
      severity: "INFO",
      category: "laboratory",
      success: true,
      metadata: {
        testId: updatedTest.testId,
        patientId: updatedTest.patientId,
        status: updatedTest.status,
      },
    });

    return NextResponse.json(updatedTest);
  } catch (error) {
    console.error("Failed to update lab test:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

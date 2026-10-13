import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, labTests } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { insertAuditRow } from "@/lib/audit";
import { resolveUserByName, recordNotifications } from "@/lib/notifications";

export async function POST(
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

    if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Phase 32: the status transition and its audit row share one
    // transaction, so the recorded Pending -> In Progress change and the
    // audit record commit together or not at all.
    const updatedTest = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(labTests)
        .set({ status: "In Progress", updatedAt: new Date() })
        .where(and(eq(labTests.id, idParsed.data.id), eq(labTests.status, "Pending")))
        .returning();

      if (!updated) {
        return null;
      }

      await insertAuditRow(tx, {
        actorId: session.user.id,
        action: "laboratory.test.process",
        entityType: "lab_test",
        entityId: updated.id,
        severity: "INFO",
        category: "laboratory",
        success: true,
        metadata: {
          testId: updated.testId,
          patientId: updated.patientId,
          consultationId: updated.consultationId,
          statusFrom: "Pending",
          statusTo: updated.status,
        },
      });

      return updated;
    });

    if (!updatedTest) {
      const [existing] = await db
        .select({ id: labTests.id })
        .from(labTests)
        .where(eq(labTests.id, idParsed.data.id))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "Lab test not found" }, { status: 404 });
      }

      return NextResponse.json(
        { error: "Lab test is not pending" },
        { status: 409 }
      );
    }

    const orderingRecipients = await resolveUserByName(updatedTest.orderedBy);
    await recordNotifications({
      recipientIds: orderingRecipients,
      type: "PATIENT",
      title: "Lab test in progress",
      message: `Lab test ${updatedTest.testId} is now in progress.`,
      action: "/laboratory",
    });

    return NextResponse.json(updatedTest);
  } catch (error) {
    console.error("Failed to process lab test:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

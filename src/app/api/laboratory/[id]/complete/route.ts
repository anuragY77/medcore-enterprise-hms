import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, labTests, medicalRecords } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { labResultEntrySchema } from "@/lib/validations/laboratory";
import { recordAudit } from "@/lib/audit";
import { resolveUserByName, recordNotifications } from "@/lib/notifications";

type LabTestRow = typeof labTests.$inferSelect;
type MedicalRecordRow = typeof medicalRecords.$inferSelect;

type CompleteResult =
  | { kind: "error"; status: number; error: string }
  | { kind: "completed"; test: LabTestRow; record: MedicalRecordRow };

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

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = labResultEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const completedAt = new Date();

    const result: CompleteResult = await db.transaction(async (tx) => {
      const [test] = await tx
        .select()
        .from(labTests)
        .where(eq(labTests.id, idParsed.data.id))
        .for("update");

      if (!test) {
        return { kind: "error", status: 404, error: "Lab test not found" };
      }

      if (test.status === "Completed") {
        return {
          kind: "error",
          status: 409,
          error: "Lab test has already been completed",
        };
      }

      const [updatedTest] = await tx
        .update(labTests)
        .set({
          status: "Completed",
          result: parsed.data.result,
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(labTests.id, test.id))
        .returning();

      const [record] = await tx
        .insert(medicalRecords)
        .values({
          patientId: test.patientId,
          recordType: "Lab",
          title: `Lab Result: ${test.testName}`.slice(0, 200),
          description: `${test.testId}: ${parsed.data.result}`,
          fileUrl: null,
          recordedBy: session.user.name,
          recordDate: completedAt,
        })
        .returning();

      return { kind: "completed", test: updatedTest, record };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "laboratory.test.complete",
      entityType: "lab_test",
      entityId: result.test.id,
      severity: "INFO",
      category: "laboratory",
      success: true,
      metadata: {
        testId: result.test.testId,
        patientId: result.test.patientId,
        consultationId: result.test.consultationId,
        medicalRecordId: result.record.id,
      },
    });

    const orderingRecipients = await resolveUserByName(result.test.orderedBy);
    await recordNotifications({
      recipientIds: orderingRecipients,
      type: "PATIENT",
      title: "Lab test completed",
      message: `Lab test ${result.test.testId} has been completed. Open the patient's records to review the result.`,
      action: `/patients/${result.test.patientId}/records`,
    });

    return NextResponse.json(
      { test: result.test, record: result.record },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to complete lab test:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

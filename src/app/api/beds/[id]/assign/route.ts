import { NextRequest, NextResponse } from "next/server";
import { eq, ne, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, beds, patients } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { bedAssignSchema } from "@/lib/validations/bed";
import { recordAudit } from "@/lib/audit";
import { resolveUsersByDepartmentRole, recordNotifications } from "@/lib/notifications";

const OCCUPIED_STATUSES = ["Occupied"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "beds:write")) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Validation failed", details: { body: ["Invalid JSON"] } }, { status: 400 });
    }

    const parsed = bedAssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { patientId } = parsed.data;

    type AssignResult =
      | { kind: "error"; status: number; error: string }
      | {
          kind: "ok";
          bed: typeof beds.$inferSelect;
          previousStatus: string;
        };

    const result: AssignResult = await db.transaction(async (tx) => {
      const [patient] = await tx
        .select({ id: patients.id, status: patients.status })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1)
        .for("update");

      if (!patient) {
        return { kind: "error", status: 404, error: "Patient not found" };
      }

      if (patient.status === "Discharged") {
        return { kind: "error", status: 409, error: "Patient has been discharged" };
      }

      const [otherBed] = await tx
        .select({ id: beds.id })
        .from(beds)
        .where(
          and(
            eq(beds.patientId, patientId),
            ne(beds.id, id),
            inArray(beds.status, OCCUPIED_STATUSES)
          )
        )
        .limit(1);

      if (otherBed) {
        return {
          kind: "error",
          status: 409,
          error: "Patient already occupies another bed",
        };
      }

      const [bed] = await tx
        .select()
        .from(beds)
        .where(eq(beds.id, id))
        .limit(1)
        .for("update");

      if (!bed) {
        return { kind: "error", status: 404, error: "Bed not found" };
      }

      if (bed.patientId === patientId && bed.status === "Occupied") {
        return {
          kind: "error",
          status: 409,
          error: "Patient is already assigned to this bed",
        };
      }

      if (bed.status !== "Available") {
        return {
          kind: "error",
          status: 409,
          error: "Bed is not available for assignment",
        };
      }

      const previousStatus = bed.status;

      const [updatedBed] = await tx
        .update(beds)
        .set({
          status: "Occupied",
          patientId,
          updatedAt: new Date(),
        })
        .where(eq(beds.id, id))
        .returning();

      return { kind: "ok", bed: updatedBed, previousStatus };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "bed.assign",
      entityType: "bed",
      entityId: result.bed.id,
      severity: "INFO",
      category: "beds",
      success: true,
      metadata: {
        bedId: result.bed.bedId,
        patientId: result.bed.patientId,
        statusFrom: result.previousStatus,
        statusTo: result.bed.status,
      },
    });

    const nurseRecipients = await resolveUsersByDepartmentRole("NURSE", result.bed.department);
    await recordNotifications({
      recipientIds: nurseRecipients,
      type: "PATIENT",
      title: "Bed assigned",
      message: `Bed ${result.bed.bedId} has been assigned.`,
      action: "/beds",
    });

    return NextResponse.json(result.bed, { status: 200 });
  } catch (error) {
    console.error("Failed to assign bed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

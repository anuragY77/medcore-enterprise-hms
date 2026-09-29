import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, beds, patients } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { bedTransferSchema } from "@/lib/validations/bed";
import { recordAudit } from "@/lib/audit";
import { resolveUsersByDepartmentRole, recordNotifications } from "@/lib/notifications";

type TransferResult =
  | { kind: "error"; status: number; error: string }
  | {
      kind: "ok";
      patient: { id: string; patientId: string };
      source: typeof beds.$inferSelect;
      destination: typeof beds.$inferSelect;
    };

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

    const parsed = bedTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { bedId: destinationId } = parsed.data;

    const [patient] = await db
      .select({ id: patients.id, patientId: patients.patientId, status: patients.status })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    if (patient.status === "Discharged") {
      return NextResponse.json({ error: "Patient has been discharged" }, { status: 409 });
    }

    const [source] = await db
      .select()
      .from(beds)
      .where(eq(beds.patientId, patient.id))
      .limit(1);
    if (!source) {
      return NextResponse.json({ error: "Patient does not occupy a bed" }, { status: 409 });
    }

    const [destination] = await db
      .select()
      .from(beds)
      .where(eq(beds.id, destinationId))
      .limit(1);
    if (!destination) {
      return NextResponse.json({ error: "Bed not found" }, { status: 404 });
    }
    if (destination.id === source.id) {
      return NextResponse.json({ error: "Patient is already assigned to this bed" }, { status: 409 });
    }
    if (destination.status !== "Available" || destination.patientId !== null) {
      return NextResponse.json({ error: "Bed is not available for assignment" }, { status: 409 });
    }

    const result: TransferResult = await db.transaction(async (tx) => {
      const [lockedPatient] = await tx
        .select({ id: patients.id, patientId: patients.patientId, status: patients.status })
        .from(patients)
        .where(eq(patients.id, patient.id))
        .limit(1)
        .for("update");

      if (!lockedPatient) {
        return { kind: "error", status: 404, error: "Patient not found" };
      }
      if (lockedPatient.status === "Discharged") {
        return { kind: "error", status: 409, error: "Patient has been discharged" };
      }

      const [firstLockId, secondLockId] =
        source.id < destination.id ? [source.id, destination.id] : [destination.id, source.id];

      const [firstLock] = await tx
        .select()
        .from(beds)
        .where(eq(beds.id, firstLockId))
        .limit(1)
        .for("update");
      const [secondLock] = await tx
        .select()
        .from(beds)
        .where(eq(beds.id, secondLockId))
        .limit(1)
        .for("update");

      const lockRow = (rowId: string) =>
        firstLock?.id === rowId ? firstLock : secondLock?.id === rowId ? secondLock : undefined;

      const lockedSource = lockRow(source.id);
      const lockedDestination = lockRow(destination.id);

      if (!lockedSource || lockedSource.patientId !== lockedPatient.id) {
        return { kind: "error", status: 409, error: "Patient no longer occupies the source bed" };
      }
      if (!lockedDestination) {
        return { kind: "error", status: 404, error: "Bed not found" };
      }
      if (lockedDestination.id === lockedSource.id) {
        return { kind: "error", status: 409, error: "Patient is already assigned to this bed" };
      }
      if (lockedDestination.status !== "Available" || lockedDestination.patientId !== null) {
        return { kind: "error", status: 409, error: "Bed is not available for assignment" };
      }

      const [updatedSource] = await tx
        .update(beds)
        .set({ status: "Available", patientId: null, updatedAt: new Date() })
        .where(eq(beds.id, lockedSource.id))
        .returning();
      const [updatedDestination] = await tx
        .update(beds)
        .set({ status: "Occupied", patientId: lockedPatient.id, updatedAt: new Date() })
        .where(eq(beds.id, lockedDestination.id))
        .returning();

      if (!updatedSource) {
        return { kind: "error", status: 409, error: "Patient no longer occupies the source bed" };
      }
      if (!updatedDestination) {
        return { kind: "error", status: 409, error: "Bed is not available for assignment" };
      }

      return {
        kind: "ok",
        patient: { id: lockedPatient.id, patientId: lockedPatient.patientId },
        source: updatedSource,
        destination: updatedDestination,
      };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "patient.transfer",
      entityType: "patient",
      entityId: result.patient.id,
      severity: "INFO",
      category: "admission",
      success: true,
      metadata: {
        patientId: result.patient.id,
        sourceBedId: result.source.id,
        destinationBedId: result.destination.id,
      },
    });

    const sourceNurses = await resolveUsersByDepartmentRole("NURSE", result.source.department);
    const destinationNurses = await resolveUsersByDepartmentRole("NURSE", result.destination.department);
    await recordNotifications({
      recipientIds: [...sourceNurses, ...destinationNurses],
      type: "PATIENT",
      title: "Patient transferred",
      message: `Patient ${result.patient.patientId} has been transferred from ${result.source.bedId} to ${result.destination.bedId}.`,
      action: `/patients/${result.patient.id}`,
    });

    return NextResponse.json(
      {
        patientId: result.patient.id,
        sourceBed: {
          id: result.source.id,
          bedId: result.source.bedId,
          roomNumber: result.source.roomNumber,
          department: result.source.department,
          ward: result.source.ward,
          type: result.source.type,
          status: result.source.status,
          patientId: result.source.patientId,
        },
        destinationBed: {
          id: result.destination.id,
          bedId: result.destination.bedId,
          roomNumber: result.destination.roomNumber,
          department: result.destination.department,
          ward: result.destination.ward,
          type: result.destination.type,
          status: result.destination.status,
          patientId: result.destination.patientId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to transfer patient:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

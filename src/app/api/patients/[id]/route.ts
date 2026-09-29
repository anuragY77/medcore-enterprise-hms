import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients, patientAllergies, patientConditions, patientMedications, beds } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { updatePatientSchema } from "@/lib/validations/patient";
import { recordAudit } from "@/lib/audit";
import { resolveUsersByDepartmentRole, recordNotifications } from "@/lib/notifications";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "patients:read")) {
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

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    const [allergies, conditions, medications] = await Promise.all([
      db.select().from(patientAllergies).where(eq(patientAllergies.patientId, id)),
      db.select().from(patientConditions).where(eq(patientConditions.patientId, id)),
      db.select().from(patientMedications).where(eq(patientMedications.patientId, id)),
    ]);

    return NextResponse.json({
      ...patient,
      allergies,
      conditions,
      medications,
    });
  } catch (error) {
    console.error("Failed to fetch patient:", error);
    return NextResponse.json(
      { error: "Failed to fetch patient" },
      { status: 500 }
    );
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
    if (!hasPermission(session.user.role, "patients:write")) {
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

    const body = await request.json();
    const parsed = updatePatientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { dateOfBirth, status, ...rest } = parsed.data;

    const [updatedPatient] = await db
      .update(patients)
      .set({
        ...rest,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        ...(status !== undefined && "status" in body ? { status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(patients.id, id))
      .returning();

    if (!updatedPatient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    await recordAudit({
      actorId: session.user.id,
      action: "patient.update",
      entityType: "patient",
      entityId: updatedPatient.id,
      severity: "INFO",
      category: "patients",
      success: true,
      metadata: {
        patientId: updatedPatient.id,
        patientNumber: updatedPatient.patientId,
        status: updatedPatient.status,
      },
    });

    return NextResponse.json(updatedPatient);
  } catch (error) {
    console.error("Failed to update patient:", error);
    return NextResponse.json(
      { error: "Failed to update patient" },
      { status: 500 }
    );
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
    if (!hasPermission(session.user.role, "patients:delete")) {
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

    type DeleteResult =
      | { kind: "error"; status: number; error: string }
      | {
          kind: "ok";
          patient: typeof patients.$inferSelect;
          releasedBeds: { id: string; bedId: string; department: string; status: string }[];
        };

    const result: DeleteResult = await db.transaction(async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(eq(patients.id, id))
        .limit(1)
        .for("update");

      if (!patient) {
        return { kind: "error", status: 404, error: "Patient not found" };
      }

      const occupiedBeds = await tx
        .select({
          id: beds.id,
          bedId: beds.bedId,
          department: beds.department,
          status: beds.status,
        })
        .from(beds)
        .where(eq(beds.patientId, id))
        .for("update");

      for (const bed of occupiedBeds) {
        await tx
          .update(beds)
          .set({ status: "Available", patientId: null, updatedAt: new Date() })
          .where(eq(beds.id, bed.id));
      }

      const [deletedPatient] = await tx
        .delete(patients)
        .where(eq(patients.id, id))
        .returning();

      if (!deletedPatient) {
        return { kind: "error", status: 404, error: "Patient not found" };
      }

      return { kind: "ok", patient: deletedPatient, releasedBeds: occupiedBeds };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "patient.delete",
      entityType: "patient",
      entityId: result.patient.id,
      severity: "WARNING",
      category: "patients",
      success: true,
      metadata: {
        patientId: result.patient.id,
        patientNumber: result.patient.patientId,
        status: result.patient.status,
      },
    });

    for (const bed of result.releasedBeds) {
      await recordAudit({
        actorId: session.user.id,
        action: "bed.release",
        entityType: "bed",
        entityId: bed.id,
        severity: "INFO",
        category: "beds",
        success: true,
        metadata: {
          bedId: bed.bedId,
          patientId: result.patient.id,
          statusFrom: bed.status,
          statusTo: "Available",
        },
      });
    }

    const bedsByDepartment = new Map<string, string[]>();
    for (const bed of result.releasedBeds) {
      const codes = bedsByDepartment.get(bed.department) ?? [];
      codes.push(bed.bedId);
      bedsByDepartment.set(bed.department, codes);
    }

    for (const [department, bedCodes] of bedsByDepartment) {
      const nurseRecipients = await resolveUsersByDepartmentRole("NURSE", department);
      await recordNotifications({
        recipientIds: nurseRecipients,
        type: "PATIENT",
        title: "Bed released",
        message: `Bed ${bedCodes.join(", ")} is now available.`,
        action: "/beds",
      });
    }

    return NextResponse.json({ message: "Patient deleted" });
  } catch (error) {
    console.error("Failed to delete patient:", error);
    return NextResponse.json(
      { error: "Failed to delete patient" },
      { status: 500 }
    );
  }
}

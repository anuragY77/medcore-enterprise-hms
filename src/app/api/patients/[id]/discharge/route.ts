import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients, medicalRecords, beds } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { dischargeSchema } from "@/lib/validations/clinical";
import { recordAudit } from "@/lib/audit";

export async function POST(
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Validation failed", details: { body: ["Invalid JSON"] } }, { status: 400 });
    }

    const parsed = dischargeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    type DischargeResult =
      | { kind: "error"; status: number; error: string }
      | {
          kind: "ok";
          patient: typeof patients.$inferSelect;
          statusFrom: string;
          releasedBeds: { id: string; bedId: string }[];
        };

    const result: DischargeResult = await db.transaction(async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(eq(patients.id, id))
        .limit(1)
        .for("update");

      if (!patient) {
        return { kind: "error", status: 404, error: "Patient not found" };
      }

      if (patient.status === "Discharged") {
        return { kind: "error", status: 409, error: "Patient is not currently admitted" };
      }

      const occupiedBeds = await tx
        .select({ id: beds.id, bedId: beds.bedId })
        .from(beds)
        .where(eq(beds.patientId, id))
        .for("update");

      for (const bed of occupiedBeds) {
        await tx
          .update(beds)
          .set({
            status: "Available",
            patientId: null,
            updatedAt: new Date(),
          })
          .where(eq(beds.id, bed.id));
      }

      const [updatedPatient] = await tx
        .update(patients)
        .set({
          status: "Discharged",
          updatedAt: new Date(),
        })
        .where(eq(patients.id, id))
        .returning();

      await tx.insert(medicalRecords).values({
        patientId: id,
        recordType: "Discharge",
        title: "Discharge Summary",
        description: JSON.stringify({
          diagnosis: parsed.data.diagnosis,
          treatmentSummary: parsed.data.treatmentSummary,
          followUpInstructions: parsed.data.followUpInstructions,
          medicationsOnDischarge: parsed.data.medicationsOnDischarge,
          followUpDate: parsed.data.followUpDate,
          notes: parsed.data.notes,
        }),
        recordedBy: session.user.name,
        recordDate: new Date(),
      });

      return { kind: "ok", patient: updatedPatient, statusFrom: patient.status, releasedBeds: occupiedBeds };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "patient.discharge",
      entityType: "patient",
      entityId: result.patient.id,
      severity: "INFO",
      category: "admission",
      success: true,
      metadata: {
        patientId: result.patient.id,
        patientNumber: result.patient.patientId,
        statusFrom: result.statusFrom,
        statusTo: result.patient.status,
        releasedBeds: result.releasedBeds.map((b) => b.bedId),
      },
    });

    return NextResponse.json(result.patient, { status: 200 });
  } catch (error) {
    console.error("Failed to discharge patient:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

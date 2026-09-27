import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients, medicalRecords, beds } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { admissionSchema } from "@/lib/validations/clinical";
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

    const parsed = admissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    type AdmissionResult =
      | { kind: "error"; status: number; error: string }
      | { kind: "ok"; patient: typeof patients.$inferSelect; statusFrom: string };

    const result: AdmissionResult = await db.transaction(async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(eq(patients.id, id))
        .limit(1)
        .for("update");

      if (!patient) {
        return { kind: "error", status: 404, error: "Patient not found" };
      }

      const [activeBed] = await tx
        .select({ id: beds.id })
        .from(beds)
        .where(and(eq(beds.patientId, id), inArray(beds.status, ["Occupied"])))
        .limit(1);

      if (activeBed) {
        return {
          kind: "error",
          status: 409,
          error: "Patient is already admitted",
        };
      }

      const [updatedPatient] = await tx
        .update(patients)
        .set({
          department: parsed.data.department,
          attendingDoctor: parsed.data.attendingDoctor,
          status: "Active",
          updatedAt: new Date(),
        })
        .where(eq(patients.id, id))
        .returning();

      await tx.insert(medicalRecords).values({
        patientId: id,
        recordType: "Administrative",
        title: "Patient Admission",
        description:
          parsed.data.reason + (parsed.data.notes ? `\n\nNotes: ${parsed.data.notes}` : ""),
        recordedBy: session.user.name,
        recordDate: new Date(),
      });

      return { kind: "ok", patient: updatedPatient, statusFrom: patient.status };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "patient.admit",
      entityType: "patient",
      entityId: result.patient.id,
      severity: "INFO",
      category: "admission",
      success: true,
      metadata: {
        patientId: result.patient.id,
        patientNumber: result.patient.patientId,
        department: result.patient.department,
        statusFrom: result.statusFrom,
        statusTo: result.patient.status,
      },
    });

    return NextResponse.json(result.patient, { status: 200 });
  } catch (error) {
    console.error("Failed to admit patient:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

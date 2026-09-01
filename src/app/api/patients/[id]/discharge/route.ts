import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients, medicalRecords } from "@/lib/db";
import { dischargeSchema } from "@/lib/validations/clinical";

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

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = dischargeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedPatient] = await db
      .update(patients)
      .set({
        status: "Discharged",
        updatedAt: new Date(),
      })
      .where(eq(patients.id, id))
      .returning();

    await db.insert(medicalRecords).values({
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

    return NextResponse.json(updatedPatient, { status: 200 });
  } catch (error) {
    console.error("Failed to discharge patient:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

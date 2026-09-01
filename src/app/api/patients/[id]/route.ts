import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, patients, patientAllergies, patientConditions, patientMedications } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
    const { id } = await params;
    const body = await request.json();

    const [updatedPatient] = await db
      .update(patients)
      .set({
        ...body,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
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
    const { id } = await params;

    const [deletedPatient] = await db
      .delete(patients)
      .where(eq(patients.id, id))
      .returning();

    if (!deletedPatient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
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

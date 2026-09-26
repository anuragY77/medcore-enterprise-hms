import { NextRequest, NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, prescriptions, patients, pharmacyMedicines } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { pickMatchingMedicine } from "@/lib/pharmacy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "pharmacy:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const [row] = await db
      .select({ prescription: prescriptions, patient: patients })
      .from(prescriptions)
      .innerJoin(patients, eq(prescriptions.patientId, patients.id))
      .where(eq(prescriptions.id, idParsed.data.id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    const medicationName = row.prescription.medicationName.trim().toLowerCase();
    const candidates = await db
      .select()
      .from(pharmacyMedicines)
      .where(
        or(
          eq(sql`lower(${pharmacyMedicines.name})`, medicationName),
          eq(sql`lower(${pharmacyMedicines.genericName})`, medicationName)
        )
      );
    const medicine = pickMatchingMedicine(candidates, row.prescription.medicationName);

    return NextResponse.json({
      prescription: row.prescription,
      patient: {
        id: row.patient.id,
        patientId: row.patient.patientId,
        firstName: row.patient.firstName,
        lastName: row.patient.lastName,
      },
      medicine: medicine
        ? {
            id: medicine.id,
            medicineId: medicine.medicineId,
            name: medicine.name,
            genericName: medicine.genericName,
            unit: medicine.unit,
            stockQuantity: medicine.stockQuantity,
            unitPrice: medicine.unitPrice,
            expiryDate: medicine.expiryDate,
            status: medicine.status,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch prescription for pharmacy:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, prescriptions, pharmacyMedicines } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { dispenseSchema } from "@/lib/validations/pharmacy";
import { pickMatchingMedicine } from "@/lib/pharmacy";
import { recordAudit } from "@/lib/audit";

type PrescriptionRow = typeof prescriptions.$inferSelect;
type MedicineRow = typeof pharmacyMedicines.$inferSelect;

type DispenseResult =
  | { kind: "error"; status: number; error: string }
  | { kind: "dispensed"; prescription: PrescriptionRow; medicine: MedicineRow };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "pharmacy:write")) {
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

    const parsed = dispenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const quantity = parsed.data.quantity;

    const result: DispenseResult = await db.transaction(async (tx) => {
      const [prescription] = await tx
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.id, idParsed.data.id))
        .for("update");

      if (!prescription) {
        return { kind: "error", status: 404, error: "Prescription not found" };
      }

      if (prescription.status !== "Active") {
        return {
          kind: "error",
          status: 409,
          error: "Prescription is not eligible for dispensing",
        };
      }

      const medicationName = prescription.medicationName.trim().toLowerCase();
      const candidates = await tx
        .select()
        .from(pharmacyMedicines)
        .where(
          or(
            eq(sql`lower(${pharmacyMedicines.name})`, medicationName),
            eq(sql`lower(${pharmacyMedicines.genericName})`, medicationName)
          )
        );
      const matched = pickMatchingMedicine(candidates, prescription.medicationName);

      if (!matched) {
        return {
          kind: "error",
          status: 409,
          error: "No matching medicine found in pharmacy stock",
        };
      }

      const [medicine] = await tx
        .select()
        .from(pharmacyMedicines)
        .where(eq(pharmacyMedicines.id, matched.id))
        .for("update");

      if (!medicine || !pickMatchingMedicine([medicine], prescription.medicationName)) {
        return {
          kind: "error",
          status: 409,
          error: "No matching medicine found in pharmacy stock",
        };
      }

      if (medicine.status !== "Active") {
        return {
          kind: "error",
          status: 409,
          error: "Medicine is not available for dispensing",
        };
      }

      if (medicine.expiryDate && medicine.expiryDate.getTime() < Date.now()) {
        return { kind: "error", status: 409, error: "Medicine has expired" };
      }

      if (medicine.stockQuantity < quantity) {
        return { kind: "error", status: 409, error: "Insufficient stock" };
      }

      const [updatedMedicine] = await tx
        .update(pharmacyMedicines)
        .set({
          stockQuantity: medicine.stockQuantity - quantity,
          updatedAt: new Date(),
        })
        .where(eq(pharmacyMedicines.id, medicine.id))
        .returning();

      const [updatedPrescription] = await tx
        .update(prescriptions)
        .set({
          status: "Completed",
          updatedAt: new Date(),
        })
        .where(eq(prescriptions.id, prescription.id))
        .returning();

      return {
        kind: "dispensed",
        prescription: updatedPrescription,
        medicine: updatedMedicine,
      };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "pharmacy.dispense",
      entityType: "prescription",
      entityId: result.prescription.id,
      severity: "INFO",
      category: "pharmacy",
      success: true,
      metadata: {
        prescriptionId: result.prescription.id,
        medicineId: result.medicine.id,
        medicineCode: result.medicine.medicineId,
        patientId: result.prescription.patientId,
        quantity,
        unit: result.medicine.unit,
        stockAfter: result.medicine.stockQuantity,
      },
    });

    return NextResponse.json(
      { prescription: result.prescription, medicine: result.medicine },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to dispense prescription:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

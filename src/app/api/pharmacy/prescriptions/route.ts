import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, prescriptions, patients, pharmacyMedicines } from "@/lib/db";
import { prescriptionQueueQuerySchema } from "@/lib/validations/pharmacy";
import { pickMatchingMedicine } from "@/lib/pharmacy";

type MedicineRow = typeof pharmacyMedicines.$inferSelect;

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const parsedQuery = prescriptionQueueQuerySchema.safeParse({
      query: searchParams.get("query") || undefined,
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedQuery.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { query, status, page, pageSize } = parsedQuery.data;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status !== "All") {
      conditions.push(eq(prescriptions.status, status));
    }
    if (query) {
      conditions.push(
        or(
          ilike(prescriptions.medicationName, `%${query}%`),
          ilike(patients.firstName, `%${query}%`),
          ilike(patients.lastName, `%${query}%`)
        )
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(prescriptions)
        .innerJoin(patients, eq(prescriptions.patientId, patients.id))
        .where(whereClause),
      db
        .select({ prescription: prescriptions, patient: patients })
        .from(prescriptions)
        .innerJoin(patients, eq(prescriptions.patientId, patients.id))
        .where(whereClause)
        .orderBy(desc(prescriptions.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const names = [
      ...new Set(
        rows.map((row) => row.prescription.medicationName.trim().toLowerCase())
      ),
    ];
    let candidates: MedicineRow[] = [];
    if (names.length > 0) {
      candidates = await db
        .select()
        .from(pharmacyMedicines)
        .where(
          or(
            ...names.map((n) =>
              or(
                eq(sql`lower(${pharmacyMedicines.name})`, n),
                eq(sql`lower(${pharmacyMedicines.genericName})`, n)
              )
            )
          )
        );
    }

    const data = rows.map((row) => {
      const medicine = pickMatchingMedicine(
        candidates,
        row.prescription.medicationName
      );
      return {
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
      };
    });

    return NextResponse.json({
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch prescription queue:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

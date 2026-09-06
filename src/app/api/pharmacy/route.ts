import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, pharmacyMedicines } from "@/lib/db";
import { pharmacyMedicineSchema } from "@/lib/validations/pharmacy";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "pharmacy:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const category = searchParams.get("category") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(pharmacyMedicines.medicineId, `%${query}%`),
          ilike(pharmacyMedicines.name, `%${query}%`),
          ilike(pharmacyMedicines.genericName, `%${query}%`),
          ilike(pharmacyMedicines.category, `%${query}%`),
          ilike(pharmacyMedicines.manufacturer, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(pharmacyMedicines.status, status));
    }

    if (category) {
      conditions.push(eq(pharmacyMedicines.category, category));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, medicinesList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(pharmacyMedicines)
        .where(whereClause),
      db
        .select()
        .from(pharmacyMedicines)
        .where(whereClause)
        .orderBy(sql`${pharmacyMedicines.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: medicinesList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch pharmacy medicines:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "pharmacy:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = pharmacyMedicineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const medicineCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(pharmacyMedicines);

    const nextNumber = Number(medicineCount[0]?.count ?? 0) + 1;
    const medicineId = `MED-${String(nextNumber).padStart(3, "0")}`;

    const [newMedicine] = await db
      .insert(pharmacyMedicines)
      .values({
        medicineId,
        name: parsed.data.name,
        genericName: parsed.data.genericName || null,
        category: parsed.data.category,
        manufacturer: parsed.data.manufacturer || null,
        description: parsed.data.description || null,
        dosage: parsed.data.dosage || null,
        unit: parsed.data.unit,
        stockQuantity: parsed.data.stockQuantity,
        reorderLevel: parsed.data.reorderLevel ?? null,
        unitPrice: parsed.data.unitPrice ?? null,
        expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null,
        status: parsed.data.status,
      })
      .returning();

    return NextResponse.json(newMedicine, { status: 201 });
  } catch (error) {
    console.error("Failed to create pharmacy medicine:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

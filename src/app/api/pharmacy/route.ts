import { NextRequest, NextResponse } from "next/server";
import { and, eq, or, ilike, isNotNull, lte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/types/auth";
import { db, pharmacyMedicines } from "@/lib/db";
import { nextBusinessId } from "@/lib/business-id";
import { paginationSchema } from "@/lib/validations/common";
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
    const pagination = paginationSchema().safeParse({
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });

    if (!pagination.success) {
      return NextResponse.json(
        { error: "Validation failed", details: pagination.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { page, pageSize } = pagination.data;
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Mirrors the client's low-stock filter: reorder level set and stock at/below it.
    const lowStockClause = and(
      whereClause,
      isNotNull(pharmacyMedicines.reorderLevel),
      lte(pharmacyMedicines.stockQuantity, pharmacyMedicines.reorderLevel)
    );

    const [countResult, medicinesList, statusCountRows, lowStockResult] = await Promise.all([
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
      db
        .select({ status: pharmacyMedicines.status, count: sql<number>`count(*)` })
        .from(pharmacyMedicines)
        .where(whereClause)
        .groupBy(pharmacyMedicines.status),
      db
        .select({ count: sql<number>`count(*)` })
        .from(pharmacyMedicines)
        .where(lowStockClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const statusCounts: Record<string, number> = {};
    for (const row of statusCountRows) {
      statusCounts[row.status] = Number(row.count ?? 0);
    }
    const lowStockCount = Number(lowStockResult[0]?.count ?? 0);

    return NextResponse.json({
      data: medicinesList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        statusCounts,
        lowStockCount,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { body: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
    const parsed = pharmacyMedicineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const medicineId = await nextBusinessId(db, "MED");

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

    await recordAudit({
      actorId: session.user.id,
      action: "pharmacy.medicine.create",
      entityType: "medicine",
      entityId: newMedicine.id,
      severity: "INFO",
      category: "pharmacy",
      success: true,
      metadata: { medicineId: newMedicine.medicineId },
    });
    return NextResponse.json(newMedicine, { status: 201 });
  } catch (error) {
    console.error("Failed to create pharmacy medicine:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

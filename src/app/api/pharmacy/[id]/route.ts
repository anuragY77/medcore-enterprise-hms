import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, pharmacyMedicines } from "@/lib/db";
import { pharmacyMedicineSchema } from "@/lib/validations/pharmacy";

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

    const { id } = await params;

    const [medicine] = await db
      .select()
      .from(pharmacyMedicines)
      .where(eq(pharmacyMedicines.id, id))
      .limit(1);

    if (!medicine) {
      return NextResponse.json({ error: "Medicine not found" }, { status: 404 });
    }

    return NextResponse.json(medicine);
  } catch (error) {
    console.error("Failed to fetch pharmacy medicine:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
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
    if (!hasPermission(session.user.role, "pharmacy:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: pharmacyMedicines.id })
      .from(pharmacyMedicines)
      .where(eq(pharmacyMedicines.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Medicine not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = pharmacyMedicineSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedMedicine] = await db
      .update(pharmacyMedicines)
      .set({
        ...parsed.data,
        name: parsed.data.name ?? undefined,
        genericName: parsed.data.genericName ?? undefined,
        category: parsed.data.category ?? undefined,
        manufacturer: parsed.data.manufacturer ?? undefined,
        description: parsed.data.description ?? undefined,
        dosage: parsed.data.dosage ?? undefined,
        unit: parsed.data.unit ?? undefined,
        stockQuantity: parsed.data.stockQuantity ?? undefined,
        reorderLevel: parsed.data.reorderLevel ?? undefined,
        unitPrice: parsed.data.unitPrice ?? undefined,
        expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : undefined,
        status: parsed.data.status ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(pharmacyMedicines.id, id))
      .returning();

    return NextResponse.json(updatedMedicine);
  } catch (error) {
    console.error("Failed to update pharmacy medicine:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

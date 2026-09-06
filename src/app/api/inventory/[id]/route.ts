import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, inventoryItems } from "@/lib/db";
import { inventoryItemSchema } from "@/lib/validations/inventory";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "inventory:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch inventory item:", error);
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
    if (!hasPermission(session.user.role, "inventory:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = inventoryItemSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedItem] = await db
      .update(inventoryItems)
      .set({
        ...parsed.data,
        name: parsed.data.name ?? undefined,
        category: parsed.data.category ?? undefined,
        description: parsed.data.description ?? undefined,
        supplier: parsed.data.supplier ?? undefined,
        quantity: parsed.data.quantity ?? undefined,
        reorderLevel: parsed.data.reorderLevel ?? undefined,
        unit: parsed.data.unit ?? undefined,
        unitPrice: parsed.data.unitPrice ?? undefined,
        location: parsed.data.location ?? undefined,
        status: parsed.data.status ?? undefined,
        lastRestockedAt: parsed.data.lastRestockedAt
          ? new Date(parsed.data.lastRestockedAt)
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Failed to update inventory item:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

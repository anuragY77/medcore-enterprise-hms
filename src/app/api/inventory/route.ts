import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, inventoryItems } from "@/lib/db";
import { inventoryItemSchema } from "@/lib/validations/inventory";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "inventory:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const category = searchParams.get("category") || "";
    const supplier = searchParams.get("supplier") || "";
    const location = searchParams.get("location") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(inventoryItems.itemId, `%${query}%`),
          ilike(inventoryItems.name, `%${query}%`),
          ilike(inventoryItems.category, `%${query}%`),
          ilike(inventoryItems.supplier, `%${query}%`),
          ilike(inventoryItems.location, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(inventoryItems.status, status));
    }

    if (category) {
      conditions.push(eq(inventoryItems.category, category));
    }

    if (supplier) {
      conditions.push(eq(inventoryItems.supplier, supplier));
    }

    if (location) {
      conditions.push(eq(inventoryItems.location, location));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, itemsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(whereClause),
      db
        .select()
        .from(inventoryItems)
        .where(whereClause)
        .orderBy(sql`${inventoryItems.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: itemsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch inventory items:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "inventory:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = inventoryItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const itemCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItems);

    const nextNumber = Number(itemCount[0]?.count ?? 0) + 1;
    const itemId = `ITM-${String(nextNumber).padStart(3, "0")}`;

    const [newItem] = await db
      .insert(inventoryItems)
      .values({
        itemId,
        name: parsed.data.name,
        category: parsed.data.category,
        description: parsed.data.description || null,
        supplier: parsed.data.supplier || null,
        quantity: parsed.data.quantity,
        reorderLevel: parsed.data.reorderLevel ?? null,
        unit: parsed.data.unit,
        unitPrice: parsed.data.unitPrice ?? null,
        location: parsed.data.location || null,
        status: parsed.data.status,
        lastRestockedAt: parsed.data.lastRestockedAt ? new Date(parsed.data.lastRestockedAt) : null,
      })
      .returning();

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create inventory item:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

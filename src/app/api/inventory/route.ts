import { NextRequest, NextResponse } from "next/server";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/types/auth";
import { db, inventoryItems } from "@/lib/db";
import { nextBusinessId } from "@/lib/business-id";
import { paginationSchema } from "@/lib/validations/common";
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, itemsList, statusRows, stockRows] = await Promise.all([
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
      db
        .select({ status: inventoryItems.status, count: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(whereClause)
        .groupBy(inventoryItems.status),
      db
        .select({
          inStock: sql<number>`count(*) filter (where ${inventoryItems.quantity} > 0 and (${inventoryItems.reorderLevel} is null or ${inventoryItems.quantity} > ${inventoryItems.reorderLevel}))`,
          lowStock: sql<number>`count(*) filter (where ${inventoryItems.reorderLevel} is not null and ${inventoryItems.quantity} <= ${inventoryItems.reorderLevel} and ${inventoryItems.quantity} > 0)`,
          outOfStock: sql<number>`count(*) filter (where ${inventoryItems.quantity} = 0)`,
        })
        .from(inventoryItems)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const statusCounts: Record<string, number> = {};
    for (const row of statusRows) {
      statusCounts[row.status] = Number(row.count);
    }

    const stockRow = stockRows[0];
    const stock = {
      inStock: Number(stockRow?.inStock ?? 0),
      lowStock: Number(stockRow?.lowStock ?? 0),
      outOfStock: Number(stockRow?.outOfStock ?? 0),
    };

    return NextResponse.json({
      data: itemsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        statusCounts,
        stock,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { body: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
    const parsed = inventoryItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const itemId = await nextBusinessId(db, "ITM");

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

    await recordAudit({
      actorId: session.user.id,
      action: "inventory.item.create",
      entityType: "inventory_item",
      entityId: newItem.id,
      severity: "INFO",
      category: "inventory",
      success: true,
      metadata: { itemId: newItem.itemId },
    });
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create inventory item:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

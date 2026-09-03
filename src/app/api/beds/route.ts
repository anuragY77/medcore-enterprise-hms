import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, beds } from "@/lib/db";
import { bedSchema } from "@/lib/validations/bed";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "beds:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const department = searchParams.get("department") || "";
    const status = searchParams.get("status") || "All";
    const type = searchParams.get("type") || "All";
    const roomNumber = searchParams.get("roomNumber") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(beds.bedId, `%${query}%`),
          ilike(beds.roomNumber, `%${query}%`),
          ilike(beds.department, `%${query}%`),
          ilike(beds.ward, `%${query}%`)
        )
      );
    }

    if (department) {
      conditions.push(eq(beds.department, department));
    }

    if (status && status !== "All") {
      conditions.push(eq(beds.status, status));
    }

    if (type && type !== "All") {
      conditions.push(eq(beds.type, type));
    }

    if (roomNumber) {
      conditions.push(eq(beds.roomNumber, roomNumber));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, bedsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(beds)
        .where(whereClause),
      db
        .select()
        .from(beds)
        .where(whereClause)
        .orderBy(sql`${beds.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: bedsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch beds:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "beds:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const bedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(beds);

    const nextNumber = Number(bedCount[0]?.count ?? 0) + 1;
    const bedId = `BED-${String(nextNumber).padStart(3, "0")}`;

    const [newBed] = await db
      .insert(beds)
      .values({
        bedId,
        roomNumber: parsed.data.roomNumber,
        department: parsed.data.department,
        ward: parsed.data.ward || null,
        type: parsed.data.type,
        status: parsed.data.status,
        patientId: parsed.data.patientId || null,
      })
      .returning();

    return NextResponse.json(newBed, { status: 201 });
  } catch (error) {
    console.error("Failed to create bed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

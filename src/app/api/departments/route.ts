import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, departments } from "@/lib/db";
import { departmentSchema } from "@/lib/validations/department";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "departments:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(departments.departmentId, `%${query}%`),
          ilike(departments.name, `%${query}%`),
          ilike(departments.headDoctor, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(departments.status, status));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, departmentsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(departments)
        .where(whereClause),
      db
        .select()
        .from(departments)
        .where(whereClause)
        .orderBy(sql`${departments.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: departmentsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "departments:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = departmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const departmentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(departments);

    const nextNumber = Number(departmentCount[0]?.count ?? 0) + 1;
    const departmentId = `DEPT-${String(nextNumber).padStart(3, "0")}`;

    const [newDepartment] = await db
      .insert(departments)
      .values({
        departmentId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        headDoctor: parsed.data.headDoctor || null,
        phone: parsed.data.phone || null,
        location: parsed.data.location || null,
        totalBeds: parsed.data.totalBeds ?? null,
        status: parsed.data.status,
      })
      .returning();

    return NextResponse.json(newDepartment, { status: 201 });
  } catch (error) {
    console.error("Failed to create department:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

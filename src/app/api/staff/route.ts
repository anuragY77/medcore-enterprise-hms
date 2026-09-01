import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, staff } from "@/lib/db";
import { staffSchema } from "@/lib/validations/staff";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "staff:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const department = searchParams.get("department") || "";
    const role = searchParams.get("role") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(staff.firstName, `%${query}%`),
          ilike(staff.lastName, `%${query}%`),
          ilike(staff.staffId, `%${query}%`),
          ilike(staff.phone, `%${query}%`),
          ilike(staff.email, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(staff.status, status));
    }

    if (department) {
      conditions.push(eq(staff.department, department));
    }

    if (role) {
      conditions.push(eq(staff.role, role));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, staffList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(staff)
        .where(whereClause),
      db
        .select()
        .from(staff)
        .where(whereClause)
        .orderBy(sql`${staff.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: staffList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch staff:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "staff:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = staffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const staffCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(staff);

    const nextNumber = Number(staffCount[0]?.count ?? 0) + 1;
    const staffId = `STF-${String(nextNumber).padStart(3, "0")}`;

    const [newStaff] = await db
      .insert(staff)
      .values({
        staffId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        role: parsed.data.role,
        department: parsed.data.department,
        specialization: parsed.data.specialization || null,
        qualification: parsed.data.qualification || null,
        experience: parsed.data.experience ?? null,
        status: parsed.data.status,
        joiningDate: parsed.data.joiningDate ? new Date(parsed.data.joiningDate) : null,
      })
      .returning();

    return NextResponse.json(newStaff, { status: 201 });
  } catch (error) {
    console.error("Failed to create staff:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

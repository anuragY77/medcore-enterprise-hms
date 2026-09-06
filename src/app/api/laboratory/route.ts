import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, labTests } from "@/lib/db";
import { labTestSchema } from "@/lib/validations/laboratory";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "laboratory:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const category = searchParams.get("category") || "";
    const patientId = searchParams.get("patientId") || "";
    const orderedBy = searchParams.get("orderedBy") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(labTests.testId, `%${query}%`),
          ilike(labTests.testName, `%${query}%`),
          ilike(labTests.category, `%${query}%`),
          ilike(labTests.orderedBy, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(labTests.status, status));
    }

    if (category) {
      conditions.push(eq(labTests.category, category));
    }

    if (patientId) {
      conditions.push(eq(labTests.patientId, patientId));
    }

    if (orderedBy) {
      conditions.push(eq(labTests.orderedBy, orderedBy));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, testsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(labTests)
        .where(whereClause),
      db
        .select()
        .from(labTests)
        .where(whereClause)
        .orderBy(sql`${labTests.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: testsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch lab tests:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "laboratory:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = labTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const testCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(labTests);

    const nextNumber = Number(testCount[0]?.count ?? 0) + 1;
    const testId = `LAB-${String(nextNumber).padStart(3, "0")}`;

    const [newTest] = await db
      .insert(labTests)
      .values({
        testId,
        patientId: parsed.data.patientId,
        consultationId: parsed.data.consultationId || null,
        testName: parsed.data.testName,
        category: parsed.data.category,
        orderedBy: parsed.data.orderedBy || null,
        status: parsed.data.status,
        result: parsed.data.result || null,
        notes: parsed.data.notes || null,
        testDate: new Date(parsed.data.testDate),
        completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
      })
      .returning();

    return NextResponse.json(newTest, { status: 201 });
  } catch (error) {
    console.error("Failed to create lab test:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, emergencyCases } from "@/lib/db";
import { emergencyCaseSchema } from "@/lib/validations/emergency";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "emergency:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const triageLevel = searchParams.get("triageLevel") || "";
    const patientId = searchParams.get("patientId") || "";
    const doctorId = searchParams.get("doctorId") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(emergencyCases.caseId, `%${query}%`),
          ilike(emergencyCases.chiefComplaint, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(emergencyCases.status, status));
    }

    if (triageLevel) {
      conditions.push(eq(emergencyCases.triageLevel, parseInt(triageLevel, 10)));
    }

    if (patientId) {
      conditions.push(eq(emergencyCases.patientId, patientId));
    }

    if (doctorId) {
      conditions.push(eq(emergencyCases.doctorId, doctorId));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, casesList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(emergencyCases)
        .where(whereClause),
      db
        .select()
        .from(emergencyCases)
        .where(whereClause)
        .orderBy(sql`${emergencyCases.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: casesList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch emergency cases:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "emergency:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = emergencyCaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const caseCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(emergencyCases);

    const nextNumber = Number(caseCount[0]?.count ?? 0) + 1;
    const caseId = `EMC-${String(nextNumber).padStart(3, "0")}`;

    const [newCase] = await db
      .insert(emergencyCases)
      .values({
        caseId,
        patientId: parsed.data.patientId,
        doctorId: parsed.data.doctorId || null,
        arrivalTime: new Date(parsed.data.arrivalTime),
        triageLevel: parsed.data.triageLevel,
        status: parsed.data.status,
        chiefComplaint: parsed.data.chiefComplaint,
        diagnosis: parsed.data.diagnosis || null,
        treatment: parsed.data.treatment || null,
        notes: parsed.data.notes || null,
      })
      .returning();

    return NextResponse.json(newCase, { status: 201 });
  } catch (error) {
    console.error("Failed to create emergency case:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

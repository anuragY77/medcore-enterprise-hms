import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, surgeries } from "@/lib/db";
import { surgerySchema } from "@/lib/validations/surgery";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "surgery:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const procedureType = searchParams.get("procedureType") || "";
    const surgeonId = searchParams.get("surgeonId") || "";
    const patientId = searchParams.get("patientId") || "";
    const department = searchParams.get("department") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(surgeries.surgeryId, `%${query}%`),
          ilike(surgeries.procedureName, `%${query}%`),
          ilike(surgeries.department, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(surgeries.status, status));
    }

    if (procedureType) {
      conditions.push(eq(surgeries.procedureType, procedureType));
    }

    if (surgeonId) {
      conditions.push(eq(surgeries.surgeonId, surgeonId));
    }

    if (patientId) {
      conditions.push(eq(surgeries.patientId, patientId));
    }

    if (department) {
      conditions.push(eq(surgeries.department, department));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, surgeriesList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(surgeries)
        .where(whereClause),
      db
        .select()
        .from(surgeries)
        .where(whereClause)
        .orderBy(sql`${surgeries.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: surgeriesList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch surgeries:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "surgery:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = surgerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const surgeryCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(surgeries);

    const nextNumber = Number(surgeryCount[0]?.count ?? 0) + 1;
    const surgeryId = `SRG-${String(nextNumber).padStart(3, "0")}`;

    const [newSurgery] = await db
      .insert(surgeries)
      .values({
        surgeryId,
        patientId: parsed.data.patientId,
        surgeonId: parsed.data.surgeonId,
        procedureName: parsed.data.procedureName,
        procedureType: parsed.data.procedureType,
        surgeryDate: new Date(parsed.data.surgeryDate),
        estimatedDuration: parsed.data.estimatedDuration || null,
        operatingRoom: parsed.data.operatingRoom || null,
        department: parsed.data.department,
        status: parsed.data.status,
        preOpNotes: parsed.data.preOpNotes || null,
        postOpNotes: parsed.data.postOpNotes || null,
        complications: parsed.data.complications || null,
        anesthesiaType: parsed.data.anesthesiaType || null,
        notes: parsed.data.notes || null,
      })
      .returning();

    return NextResponse.json(newSurgery, { status: 201 });
  } catch (error) {
    console.error("Failed to create surgery:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

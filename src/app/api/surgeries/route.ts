import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, surgeries, patients, staff } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";
import { surgerySchema } from "@/lib/validations/surgery";
import { recordAudit } from "@/lib/audit";
import { nextBusinessId } from "@/lib/business-id";

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

    const filterCheck = z
      .object({
        surgeonId: z.string().uuid("Invalid surgeon ID").optional(),
        patientId: z.string().uuid("Invalid patient ID").optional(),
      })
      .safeParse({
        surgeonId: surgeonId || undefined,
        patientId: patientId || undefined,
      });

    if (!filterCheck.success) {
      return NextResponse.json(
        { error: "Validation failed", details: filterCheck.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { body: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
    const parsed = surgerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Phase 22: referenced rows must exist before insert, so garbage UUIDs
    // cannot reach the foreign keys (23503 -> 500).
    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, parsed.data.patientId))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const [surgeon] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.id, parsed.data.surgeonId))
      .limit(1);

    if (!surgeon) {
      return NextResponse.json({ error: "Surgeon not found" }, { status: 404 });
    }

    const surgeryId = await nextBusinessId(db, "SRG");

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

    await recordAudit({
      actorId: session.user.id,
      action: "surgery.create",
      entityType: "surgery",
      entityId: newSurgery.id,
      severity: "WARNING",
      category: "surgery",
      success: true,
      metadata: {
        surgeryCode: newSurgery.surgeryId,
        patientId: newSurgery.patientId,
        surgeonId: newSurgery.surgeonId,
        department: newSurgery.department,
        status: newSurgery.status,
      },
    });

    return NextResponse.json(newSurgery, { status: 201 });
  } catch (error) {
    console.error("Failed to create surgery:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, labTests, patients, consultations } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";
import { labTestSchema } from "@/lib/validations/laboratory";
import { recordAudit } from "@/lib/audit";
import { nextBusinessId } from "@/lib/business-id";

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

    const filterCheck = z
      .object({
        patientId: z.string().uuid("Invalid patient ID").optional(),
      })
      .safeParse({
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, statusCountsList, testsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(labTests)
        .where(whereClause),
      db
        .select({ status: labTests.status, count: sql<number>`count(*)` })
        .from(labTests)
        .where(whereClause)
        .groupBy(labTests.status),
      db
        .select()
        .from(labTests)
        .where(whereClause)
        .orderBy(sql`${labTests.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    // Per-status totals over the same filter as the list, so the KPI cards
    // reflect the whole result set instead of the current page slice.
    const statusCounts: Record<string, number> = {};
    for (const row of statusCountsList) {
      statusCounts[row.status] = Number(row.count);
    }

    return NextResponse.json({
      data: testsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        statusCounts,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { body: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
    const parsed = labTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.status === "Completed") {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: {
            status: ["Lab tests cannot be created as completed; enter the result through the laboratory workflow"],
          },
        },
        { status: 400 }
      );
    }

    if (parsed.data.result && parsed.data.result.trim().length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: { result: ["Results can only be entered when completing a test"] },
        },
        { status: 400 }
      );
    }

    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, parsed.data.patientId))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (parsed.data.consultationId) {
      const [consultation] = await db
        .select({ id: consultations.id, patientId: consultations.patientId })
        .from(consultations)
        .where(eq(consultations.id, parsed.data.consultationId))
        .limit(1);

      if (!consultation) {
        return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
      }

      if (consultation.patientId !== parsed.data.patientId) {
        return NextResponse.json(
          { error: "Consultation does not belong to this patient" },
          { status: 409 }
        );
      }
    }

    const testId = await nextBusinessId(db, "LAB");

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
        result: null,
        notes: parsed.data.notes || null,
        testDate: new Date(parsed.data.testDate),
        completedAt: null,
      })
      .returning();

    await recordAudit({
      actorId: session.user.id,
      action: "laboratory.test.create",
      entityType: "lab_test",
      entityId: newTest.id,
      severity: "INFO",
      category: "laboratory",
      success: true,
      metadata: {
        testId: newTest.testId,
        patientId: newTest.patientId,
        consultationId: newTest.consultationId,
        status: newTest.status,
      },
    });

    return NextResponse.json(newTest, { status: 201 });
  } catch (error) {
    console.error("Failed to create lab test:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

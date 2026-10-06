import { NextRequest, NextResponse } from "next/server";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";
import { patientSchema } from "@/lib/validations/patient";
import { recordAudit } from "@/lib/audit";
import { nextBusinessId } from "@/lib/business-id";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "patients:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const pagination = paginationSchema(10).safeParse({
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
          ilike(patients.firstName, `%${query}%`),
          ilike(patients.lastName, `%${query}%`),
          ilike(patients.patientId, `%${query}%`),
          ilike(patients.phone, `%${query}%`),
          ilike(patients.email, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(patients.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, patientsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(whereClause),
      db
        .select()
        .from(patients)
        .where(whereClause)
        .orderBy(sql`${patients.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      patients: patientsList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Failed to fetch patients:", error);
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "patients:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Phase 21: the create endpoint previously destructured the raw body with
    // a hand-rolled required-fields check and only validated dateOfBirth, so
    // arbitrary strings reached the database (status, gender, oversized
    // fields). The full schema is applied server-side; the client form uses
    // the same schema as its zodResolver, so legitimate payloads are
    // unaffected.
    const parsed = patientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const patientId = await nextBusinessId(db, "PT");

    const [newPatient] = await db
      .insert(patients)
      .values({
        patientId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: new Date(parsed.data.dateOfBirth),
        gender: parsed.data.gender,
        bloodGroup: parsed.data.bloodGroup || null,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        department: parsed.data.department,
        attendingDoctor: parsed.data.attendingDoctor,
        status: parsed.data.status,
        insuranceProvider: parsed.data.insuranceProvider || null,
        insurancePolicyNumber: parsed.data.insurancePolicyNumber || null,
        emergencyContactName: parsed.data.emergencyContactName || null,
        emergencyContactPhone: parsed.data.emergencyContactPhone || null,
      })
      .returning();

    await recordAudit({
      actorId: session.user.id,
      action: "patient.create",
      entityType: "patient",
      entityId: newPatient.id,
      severity: "INFO",
      category: "patients",
      success: true,
      metadata: {
        patientId: newPatient.id,
        patientNumber: newPatient.patientId,
        status: newPatient.status,
      },
    });

    return NextResponse.json(newPatient, { status: 201 });
  } catch (error) {
    console.error("Failed to create patient:", error);
    return NextResponse.json(
      { error: "Failed to create patient" },
      { status: 500 }
    );
  }
}

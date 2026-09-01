import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, prescriptions, patients } from "@/lib/db";
import { prescriptionSchema } from "@/lib/validations/clinical";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "All";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [eq(prescriptions.patientId, id)];
    if (status && status !== "All") {
      conditions.push(eq(prescriptions.status, status));
    }

    const whereClause = sql`${conditions[0]}`;

    const [countResult, prescriptionsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(prescriptions)
        .where(whereClause),
      db
        .select()
        .from(prescriptions)
        .where(whereClause)
        .orderBy(sql`${prescriptions.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: prescriptionsList,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Failed to fetch prescriptions:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "patients:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = prescriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [newPrescription] = await db
      .insert(prescriptions)
      .values({
        patientId: id,
        consultationId: parsed.data.consultationId || null,
        medicationName: parsed.data.medicationName,
        dosage: parsed.data.dosage,
        frequency: parsed.data.frequency,
        duration: parsed.data.duration || null,
        instructions: parsed.data.instructions || null,
        prescribedBy: parsed.data.prescribedBy,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      })
      .returning();

    return NextResponse.json(newPrescription, { status: 201 });
  } catch (error) {
    console.error("Failed to create prescription:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

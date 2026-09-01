import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, consultations, patients } from "@/lib/db";
import { consultationSchema } from "@/lib/validations/clinical";

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
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const [countResult, consultationsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(consultations)
        .where(eq(consultations.patientId, id)),
      db
        .select()
        .from(consultations)
        .where(eq(consultations.patientId, id))
        .orderBy(sql`${consultations.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: consultationsList,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Failed to fetch consultations:", error);
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
    const parsed = consultationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [newConsultation] = await db
      .insert(consultations)
      .values({
        patientId: id,
        doctorName: parsed.data.doctorName,
        chiefComplaint: parsed.data.chiefComplaint,
        diagnosis: parsed.data.diagnosis,
        treatmentPlan: parsed.data.treatmentPlan || null,
        notes: parsed.data.notes || null,
        followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
      })
      .returning();

    return NextResponse.json(newConsultation, { status: 201 });
  } catch (error) {
    console.error("Failed to create consultation:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

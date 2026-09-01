import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, medicalRecords, patients } from "@/lib/db";
import { medicalRecordSchema } from "@/lib/validations/clinical";

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
    const recordType = searchParams.get("recordType") || "All";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [eq(medicalRecords.patientId, id)];
    if (recordType && recordType !== "All") {
      conditions.push(eq(medicalRecords.recordType, recordType));
    }

    const whereClause = sql`${conditions[0]}`;

    const [countResult, recordsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(medicalRecords)
        .where(whereClause),
      db
        .select()
        .from(medicalRecords)
        .where(whereClause)
        .orderBy(sql`${medicalRecords.recordDate} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: recordsList,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Failed to fetch medical records:", error);
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
    const parsed = medicalRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [newRecord] = await db
      .insert(medicalRecords)
      .values({
        patientId: id,
        recordType: parsed.data.recordType,
        title: parsed.data.title,
        description: parsed.data.description || null,
        fileUrl: parsed.data.fileUrl || null,
        recordedBy: parsed.data.recordedBy,
        recordDate: parsed.data.recordDate ? new Date(parsed.data.recordDate) : new Date(),
      })
      .returning();

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error) {
    console.error("Failed to create medical record:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

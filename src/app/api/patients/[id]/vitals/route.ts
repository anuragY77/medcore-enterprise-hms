import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, vitals, patients } from "@/lib/db";
import { vitalSchema } from "@/lib/validations/clinical";

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
    const latest = searchParams.get("latest");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    if (latest === "true") {
      const [latestVital] = await db
        .select()
        .from(vitals)
        .where(eq(vitals.patientId, id))
        .orderBy(sql`${vitals.recordedAt} DESC`)
        .limit(1);

      return NextResponse.json({ data: latestVital || null });
    }

    const [countResult, vitalsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(vitals)
        .where(eq(vitals.patientId, id)),
      db
        .select()
        .from(vitals)
        .where(eq(vitals.patientId, id))
        .orderBy(sql`${vitals.recordedAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: vitalsList,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Failed to fetch vitals:", error);
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
    const parsed = vitalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [newVital] = await db
      .insert(vitals)
      .values({
        patientId: id,
        bloodPressureSystolic: parsed.data.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: parsed.data.bloodPressureDiastolic ?? null,
        heartRate: parsed.data.heartRate ?? null,
        temperature: parsed.data.temperature ?? null,
        respiratoryRate: parsed.data.respiratoryRate ?? null,
        oxygenSaturation: parsed.data.oxygenSaturation ?? null,
        weight: parsed.data.weight ?? null,
        height: parsed.data.height ?? null,
        recordedBy: parsed.data.recordedBy,
        recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
      })
      .returning();

    return NextResponse.json(newVital, { status: 201 });
  } catch (error) {
    console.error("Failed to create vital:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

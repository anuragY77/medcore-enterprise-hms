import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients, beds, vitals } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "nursing:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const ward = searchParams.get("ward") || "";
    const status = searchParams.get("status") || "All";

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(patients.firstName, `%${search}%`),
          ilike(patients.lastName, `%${search}%`),
          ilike(patients.patientId, `%${search}%`),
          ilike(beds.roomNumber, `%${search}%`)
        )
      );
    }

    if (ward) {
      conditions.push(eq(beds.ward, ward));
    }

    if (status && status !== "All") {
      conditions.push(eq(patients.status, status));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const patientsWithBeds = await db
      .select({
        id: patients.id,
        patientId: patients.patientId,
        firstName: patients.firstName,
        lastName: patients.lastName,
        gender: patients.gender,
        department: patients.department,
        attendingDoctor: patients.attendingDoctor,
        status: patients.status,
        bedId: beds.bedId,
        roomNumber: beds.roomNumber,
        ward: beds.ward,
        bedType: beds.type,
        bedStatus: beds.status,
      })
      .from(patients)
      .innerJoin(beds, eq(beds.patientId, patients.id))
      .where(whereClause)
      .orderBy(sql`${patients.lastName} ASC`);

    if (patientsWithBeds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const patientIds = patientsWithBeds.map((p) => p.id);

    const latestVitals = await db
      .select({
        patientId: vitals.patientId,
        bloodPressureSystolic: vitals.bloodPressureSystolic,
        bloodPressureDiastolic: vitals.bloodPressureDiastolic,
        heartRate: vitals.heartRate,
        temperature: vitals.temperature,
        oxygenSaturation: vitals.oxygenSaturation,
        recordedAt: vitals.recordedAt,
      })
      .from(vitals)
      .where(sql`${vitals.patientId} IN ${patientIds}`)
      .orderBy(sql`${vitals.recordedAt} DESC`);

    const vitalsByPatient = new Map<string, (typeof latestVitals)[number]>();
    for (const vital of latestVitals) {
      if (!vitalsByPatient.has(vital.patientId)) {
        vitalsByPatient.set(vital.patientId, vital);
      }
    }

    const enrichedPatients = patientsWithBeds.map((patient) => ({
      ...patient,
      latestVitals: vitalsByPatient.get(patient.id) || null,
    }));

    return NextResponse.json({ data: enrichedPatients });
  } catch (error) {
    console.error("Failed to fetch ward patients:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

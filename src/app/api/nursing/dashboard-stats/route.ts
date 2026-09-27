import { NextResponse } from "next/server";
import { sql, eq, and, gte, lt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients, beds, prescriptions, emergencyCases, medicalRecords } from "@/lib/db";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfNextDay(date: Date): Date {
  const s = startOfDay(date);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
}

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "nursing:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = startOfNextDay(now);

    const [patientsAssignedResult, medsDueResult, alertsResult, shiftResult] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(beds)
          .innerJoin(patients, eq(beds.patientId, patients.id)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(prescriptions)
          .where(eq(prescriptions.status, "Active")),
        db
          .select({ count: sql<number>`count(*)` })
          .from(emergencyCases)
          .where(eq(emergencyCases.status, "Waiting")),
        db
          .select({
            admissionsToday: sql<number>`count(*) filter (where ${medicalRecords.title} = 'Patient Admission')`,
            dischargesToday: sql<number>`count(*) filter (where ${medicalRecords.recordType} = 'Discharge')`,
          })
          .from(medicalRecords)
          .where(
            and(
              gte(medicalRecords.recordDate, todayStart),
              lt(medicalRecords.recordDate, todayEnd)
            )
          ),
      ]);

    const patientsAssigned = Number(patientsAssignedResult?.[0]?.count ?? 0);
    const medsDue = Number(medsDueResult?.[0]?.count ?? 0);
    const alerts = Number(alertsResult?.[0]?.count ?? 0);
    const pendingTasks = medsDue + alerts;
    const admissionsToday = Number(shiftResult?.[0]?.admissionsToday ?? 0);
    const dischargesToday = Number(shiftResult?.[0]?.dischargesToday ?? 0);

    return NextResponse.json({
      data: {
        patientsAssigned,
        pendingTasks,
        medsDue,
        alerts,
        admissionsToday,
        dischargesToday,
      },
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

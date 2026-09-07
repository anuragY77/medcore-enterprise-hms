import { NextResponse } from "next/server";
import { sql, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients, beds, prescriptions, emergencyCases } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "nursing:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [patientsAssignedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(beds)
      .innerJoin(patients, eq(beds.patientId, patients.id));

    const [medsDueResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prescriptions)
      .where(eq(prescriptions.status, "Active"));

    const [alertsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(emergencyCases)
      .where(eq(emergencyCases.status, "Waiting"));

    const patientsAssigned = Number(patientsAssignedResult?.count ?? 0);
    const medsDue = Number(medsDueResult?.count ?? 0);
    const alerts = Number(alertsResult?.count ?? 0);
    const pendingTasks = medsDue + alerts;

    return NextResponse.json({
      data: {
        patientsAssigned,
        pendingTasks,
        medsDue,
        alerts,
      },
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import {
  db,
  patients,
  appointments,
  beds,
  staff,
  medicalRecords,
  emergencyCases,
  invoices,
  auditLogs,
} from "@/lib/db";
import type { DashboardActivityEvent, DashboardStats } from "@/types/dashboard";

// Server-local day boundaries, the same half-open convention used by the
// Reports API (start of local day inclusive, start of next day exclusive).
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfNextDay(date: Date): Date {
  const s = startOfDay(date);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function describeAction(action: string): string {
  switch (action) {
    case "user.create":
      return "User account created";
    case "auth.login":
      return "User signed in";
    case "auth.login_invalid_password":
      return "Sign-in failed: invalid password";
    case "auth.login_invalid_role":
      return "Sign-in failed: invalid role";
    default:
      break;
  }
  const spaced = action.replace(/[._]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const ALERT_SEVERITIES = ["WARNING", "ERROR", "CRITICAL"];

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = startOfNextDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // 7-day chart window over UTC calendar days so it lines up exactly with
    // the DATE() bucketing of recordDate (JS-written timestamps are stored
    // as UTC wall time by node-postgres).
    const chartStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)
    );

    const pendingAppointmentStatus = inArray(appointments.status, [
      "Scheduled",
      "Confirmed",
    ]);

    const [
      patientAgg,
      bedByDept,
      apptAgg,
      admissionAgg,
      erAgg,
      staffByDept,
      invoiceAgg,
      chartRows,
      activityRows,
    ] = await Promise.all([
      db
        .select({
          total: count(),
          newThisMonth: sql<number>`count(*) filter (where ${patients.createdAt} >= ${monthStart})`,
          active: sql<number>`count(*) filter (where ${patients.status} <> 'Discharged')`,
          critical: sql<number>`count(*) filter (where ${patients.status} = 'Critical')`,
        })
        .from(patients),
      db
        .select({
          name: beds.department,
          total: sql<number>`count(*)`,
          occupied: sql<number>`count(*) filter (where ${beds.status} = 'Occupied')`,
          available: sql<number>`count(*) filter (where ${beds.status} = 'Available')`,
        })
        .from(beds)
        .groupBy(beds.department)
        .orderBy(beds.department),
      db
        .select({
          today: sql<number>`count(*) filter (where ${appointments.date} < ${todayEnd})`,
          pendingToday: sql<number>`count(*) filter (where ${appointments.date} < ${todayEnd} and ${pendingAppointmentStatus})`,
          upcomingPending: sql<number>`count(*) filter (where ${pendingAppointmentStatus})`,
        })
        .from(appointments)
        .where(gte(appointments.date, todayStart)),
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
      db
        .select({ value: count() })
        .from(emergencyCases)
        .where(
          and(
            gte(emergencyCases.arrivalTime, todayStart),
            lt(emergencyCases.arrivalTime, todayEnd)
          )
        ),
      db
        .select({ name: staff.department, total: count() })
        .from(staff)
        .where(eq(staff.status, "Active"))
        .groupBy(staff.department),
      db
        .select({
          totalInvoiced: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
          totalPaid: sql<string>`coalesce(sum(${invoices.paidAmount}), 0)`,
        })
        .from(invoices),
      db
        .select({
          day: sql<string>`to_char(date(${medicalRecords.recordDate}), 'YYYY-MM-DD')`,
          admissions: sql<number>`count(*) filter (where ${medicalRecords.title} = 'Patient Admission')`,
          discharges: sql<number>`count(*) filter (where ${medicalRecords.recordType} = 'Discharge')`,
        })
        .from(medicalRecords)
        .where(gte(medicalRecords.recordDate, chartStart))
        .groupBy(sql`date(${medicalRecords.recordDate})`)
        .orderBy(sql`date(${medicalRecords.recordDate})`),
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          severity: auditLogs.severity,
          timestamp: auditLogs.timestamp,
        })
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(8),
    ]);

    const bedsTotal = bedByDept.reduce((sum, row) => sum + toNumber(row.total), 0);
    const bedsOccupied = bedByDept.reduce(
      (sum, row) => sum + toNumber(row.occupied),
      0
    );
    const bedsAvailable = bedByDept.reduce(
      (sum, row) => sum + toNumber(row.available),
      0
    );
    const bedsOccupancyPercentage =
      bedsTotal > 0 ? round2((bedsOccupied / bedsTotal) * 100) : 0;

    const activeStaffByDept = new Map(
      staffByDept.map((row) => [row.name, toNumber(row.total)])
    );

    const departments = bedByDept.map((row) => {
      const occupied = toNumber(row.occupied);
      const total = toNumber(row.total);
      const occupancyPercentage = total > 0 ? round2((occupied / total) * 100) : 0;
      return {
        name: row.name,
        bedsOccupied: occupied,
        bedsTotal: total,
        activeStaff: activeStaffByDept.get(row.name) ?? 0,
        occupancyPercentage,
        status:
          occupancyPercentage >= 90
            ? ("critical" as const)
            : occupancyPercentage >= 70
              ? ("warning" as const)
              : ("available" as const),
      };
    });

    const totalInvoiced = toNumber(invoiceAgg[0]?.totalInvoiced);
    const totalPaid = toNumber(invoiceAgg[0]?.totalPaid);

    const chartByDay = new Map(
      chartRows.map((row) => [row.day, row])
    );
    const admissionsChart: DashboardStats["admissionsChart"] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(chartStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const row = chartByDay.get(key);
      admissionsChart.push({
        day: d.toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        }),
        admissions: row ? toNumber(row.admissions) : 0,
        discharges: row ? toNumber(row.discharges) : 0,
      });
    }

    const activity: DashboardActivityEvent[] = activityRows.map((row) => ({
      id: row.id,
      description: describeAction(row.action),
      timestamp: row.timestamp.toISOString(),
      type:
        row.severity && ALERT_SEVERITIES.includes(row.severity.toUpperCase())
          ? "alert"
          : "audit",
    }));

    const data: DashboardStats = {
      patients: {
        total: toNumber(patientAgg[0]?.total),
        newThisMonth: toNumber(patientAgg[0]?.newThisMonth),
        active: toNumber(patientAgg[0]?.active),
        critical: toNumber(patientAgg[0]?.critical),
      },
      appointments: {
        today: toNumber(apptAgg[0]?.today),
        pendingToday: toNumber(apptAgg[0]?.pendingToday),
        upcomingPending: toNumber(apptAgg[0]?.upcomingPending),
      },
      beds: {
        total: bedsTotal,
        occupied: bedsOccupied,
        available: bedsAvailable,
        occupancyPercentage: bedsOccupancyPercentage,
      },
      operations: {
        admissionsToday: toNumber(admissionAgg[0]?.admissionsToday),
        dischargesToday: toNumber(admissionAgg[0]?.dischargesToday),
        pendingCases: toNumber(apptAgg[0]?.upcomingPending),
        erVisitsToday: toNumber(erAgg[0]?.value),
      },
      departments,
      financial: {
        totalInvoiced: round2(totalInvoiced),
        totalPaid: round2(totalPaid),
        outstanding: round2(totalInvoiced - totalPaid),
      },
      admissionsChart,
      activity,
    };

    return NextResponse.json({
      data,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

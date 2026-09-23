import { NextRequest, NextResponse } from "next/server";
import { and, count, gte, lt, sql, type SQL } from "drizzle-orm";
import type { Column } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import {
  db,
  patients,
  invoices,
  insuranceClaims,
  appointments,
  beds,
  emergencyCases,
  surgeries,
} from "@/lib/db";
import { reportQuerySchema } from "@/lib/validations/reports";

function startOfDay(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

// Half-open end boundary so records throughout the requested end date are included.
function endExclusive(dateStr: string): Date {
  const s = startOfDay(dateStr);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function groupToMap(
  rows: { key: string; value: string | number | null }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.key] = toNumber(row.value);
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "reports:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const raw: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (value !== "") {
        raw[key] = value;
      }
    });

    const parsed = reportQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { from, to } = parsed.data;
    const fromAt = from ? startOfDay(from) : undefined;
    const toEx = to ? endExclusive(to) : undefined;

    const rangeOn = (column: Column): SQL | undefined => {
      const conditions = [];
      if (fromAt) conditions.push(gte(column, fromAt));
      if (toEx) conditions.push(lt(column, toEx));
      return conditions.length > 0 ? and(...conditions) : undefined;
    };

    // Beds are a point-in-time inventory snapshot; date filters do not apply.
    const bedWhere = undefined;
    const appointmentWhere = (() => {
      const conditions = [];
      if (fromAt) conditions.push(gte(appointments.date, fromAt));
      if (toEx) conditions.push(lt(appointments.date, toEx));
      return conditions.length > 0 ? and(...conditions) : undefined;
    })();
    const emergencyWhere = (() => {
      const conditions = [];
      if (fromAt) conditions.push(gte(emergencyCases.arrivalTime, fromAt));
      if (toEx) conditions.push(lt(emergencyCases.arrivalTime, toEx));
      return conditions.length > 0 ? and(...conditions) : undefined;
    })();
    const surgeryWhere = (() => {
      const conditions = [];
      if (fromAt) conditions.push(gte(surgeries.surgeryDate, fromAt));
      if (toEx) conditions.push(lt(surgeries.surgeryDate, toEx));
      return conditions.length > 0 ? and(...conditions) : undefined;
    })();

    const patientRange = rangeOn(patients.createdAt);
    const invoiceRange = rangeOn(invoices.createdAt);
    const claimRange = rangeOn(insuranceClaims.createdAt);

    const [
      patientTotal,
      patientNew,
      patientByStatus,
      patientByGender,
      patientByDepartment,
      invoiceTotals,
      invoicesByStatus,
      claimTotals,
      claimsByStatus,
      appointmentTotal,
      appointmentsByStatus,
      bedTotals,
      bedsByStatus,
      emergencyTotal,
      emergencyByStatus,
      surgeryTotal,
      surgeriesByStatus,
    ] = await Promise.all([
      db.select({ value: count() }).from(patients),
      patientRange
        ? db.select({ value: count() }).from(patients).where(patientRange)
        : db.select({ value: count() }).from(patients),
      db
        .select({ key: patients.status, value: count() })
        .from(patients)
        .groupBy(patients.status)
        .orderBy(patients.status),
      db
        .select({ key: patients.gender, value: count() })
        .from(patients)
        .groupBy(patients.gender)
        .orderBy(patients.gender),
      db
        .select({ key: patients.department, value: count() })
        .from(patients)
        .groupBy(patients.department)
        .orderBy(patients.department),
      db
        .select({
          totalInvoiced: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
          totalPaid: sql<string>`coalesce(sum(${invoices.paidAmount}), 0)`,
          invoiceCount: sql<string>`count(*)`,
        })
        .from(invoices)
        .where(invoiceRange),
      db
        .select({ key: invoices.status, value: count() })
        .from(invoices)
        .where(invoiceRange)
        .groupBy(invoices.status)
        .orderBy(invoices.status),
      db
        .select({
          claimCount: sql<string>`count(*)`,
          totalClaimAmount: sql<string>`coalesce(sum(${insuranceClaims.claimAmount}), 0)`,
          totalApprovedAmount: sql<string>`coalesce(sum(${insuranceClaims.approvedAmount}), 0)`,
        })
        .from(insuranceClaims)
        .where(claimRange),
      db
        .select({ key: insuranceClaims.status, value: count() })
        .from(insuranceClaims)
        .where(claimRange)
        .groupBy(insuranceClaims.status)
        .orderBy(insuranceClaims.status),
      appointmentWhere
        ? db.select({ value: count() }).from(appointments).where(appointmentWhere)
        : db.select({ value: count() }).from(appointments),
      db
        .select({ key: appointments.status, value: count() })
        .from(appointments)
        .where(appointmentWhere)
        .groupBy(appointments.status)
        .orderBy(appointments.status),
      db
        .select({
          totalBeds: sql<string>`count(*)`,
          occupiedBeds: sql<string>`count(*) filter (where ${beds.status} = 'Occupied')`,
          availableBeds: sql<string>`count(*) filter (where ${beds.status} = 'Available')`,
        })
        .from(beds)
        .where(bedWhere),
      db
        .select({ key: beds.status, value: count() })
        .from(beds)
        .where(bedWhere)
        .groupBy(beds.status)
        .orderBy(beds.status),
      emergencyWhere
        ? db.select({ value: count() }).from(emergencyCases).where(emergencyWhere)
        : db.select({ value: count() }).from(emergencyCases),
      db
        .select({ key: emergencyCases.status, value: count() })
        .from(emergencyCases)
        .where(emergencyWhere)
        .groupBy(emergencyCases.status)
        .orderBy(emergencyCases.status),
      surgeryWhere
        ? db.select({ value: count() }).from(surgeries).where(surgeryWhere)
        : db.select({ value: count() }).from(surgeries),
      db
        .select({ key: surgeries.status, value: count() })
        .from(surgeries)
        .where(surgeryWhere)
        .groupBy(surgeries.status)
        .orderBy(surgeries.status),
    ]);

    const totalBeds = toNumber(bedTotals[0]?.totalBeds);
    const occupiedBeds = toNumber(bedTotals[0]?.occupiedBeds);
    const availableBeds = toNumber(bedTotals[0]?.availableBeds);
    const occupancyPercentage =
      totalBeds > 0 ? round2((occupiedBeds / totalBeds) * 100) : 0;

    const totalInvoiced = toNumber(invoiceTotals[0]?.totalInvoiced);
    const totalPaid = toNumber(invoiceTotals[0]?.totalPaid);

    const totalClaimAmount = toNumber(claimTotals[0]?.totalClaimAmount);
    const totalApprovedAmount = toNumber(claimTotals[0]?.totalApprovedAmount);

    return NextResponse.json({
      data: {
        patients: {
          totalPatients: toNumber(patientTotal[0]?.value),
          newPatients: toNumber(patientNew[0]?.value),
          patientsByStatus: groupToMap(patientByStatus),
          patientsByGender: groupToMap(patientByGender),
          patientsByDepartment: groupToMap(patientByDepartment),
        },
        financial: {
          totalInvoiced: round2(totalInvoiced),
          totalPaid: round2(totalPaid),
          totalOutstanding: round2(totalInvoiced - totalPaid),
          invoiceCount: toNumber(invoiceTotals[0]?.invoiceCount),
          invoicesByStatus: groupToMap(invoicesByStatus),
          claimCount: toNumber(claimTotals[0]?.claimCount),
          totalClaimAmount: round2(totalClaimAmount),
          totalApprovedAmount: round2(totalApprovedAmount),
          claimsByStatus: groupToMap(claimsByStatus),
        },
        operations: {
          appointments: {
            total: toNumber(appointmentTotal[0]?.value),
            byStatus: groupToMap(appointmentsByStatus),
          },
          beds: {
            total: totalBeds,
            occupied: occupiedBeds,
            available: availableBeds,
            occupancyPercentage,
            byStatus: groupToMap(bedsByStatus),
          },
          emergency: {
            total: toNumber(emergencyTotal[0]?.value),
            byStatus: groupToMap(emergencyByStatus),
          },
          surgeries: {
            total: toNumber(surgeryTotal[0]?.value),
            byStatus: groupToMap(surgeriesByStatus),
          },
        },
      },
      meta: {
        from: from ?? null,
        to: to ?? null,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

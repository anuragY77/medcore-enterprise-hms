import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, appointments, patients } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";
import { appointmentSchema } from "@/lib/validations/appointment";
import { recordAudit } from "@/lib/audit";
import { nextBusinessId } from "@/lib/business-id";
import { resolveUserByName, recordNotifications } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "appointments:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const department = searchParams.get("department") || "";
    const doctorName = searchParams.get("doctorName") || "";
    const date = searchParams.get("date") || "";

    const filterCheck = z
      .object({
        date: z
          .string()
          .refine(
            (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime()),
            { message: "Invalid date" }
          )
          .optional(),
      })
      .safeParse({
        date: date || undefined,
      });

    if (!filterCheck.success) {
      return NextResponse.json(
        { error: "Validation failed", details: filterCheck.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const pagination = paginationSchema().safeParse({
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
          ilike(appointments.appointmentId, `%${query}%`),
          ilike(appointments.doctorName, `%${query}%`),
          ilike(appointments.department, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(appointments.status, status));
    }

    if (department) {
      conditions.push(eq(appointments.department, department));
    }

    if (doctorName) {
      conditions.push(eq(appointments.doctorName, doctorName));
    }

    if (date) {
      conditions.push(sql`DATE(${appointments.date}) = ${date}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, appointmentsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(whereClause),
      db
        .select()
        .from(appointments)
        .where(whereClause)
        .orderBy(sql`${appointments.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: appointmentsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "appointments:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = appointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Phase 22: reject unknown patients before insert so a garbage UUID
    // cannot reach the foreign key (23503 -> 500).
    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, parsed.data.patientId))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const appointmentId = await nextBusinessId(db, "APT");

    const [newAppointment] = await db
      .insert(appointments)
      .values({
        appointmentId,
        patientId: parsed.data.patientId,
        doctorName: parsed.data.doctorName,
        department: parsed.data.department,
        date: new Date(parsed.data.date),
        time: parsed.data.time,
        type: parsed.data.type,
        status: parsed.data.status,
        reason: parsed.data.reason || null,
        notes: parsed.data.notes || null,
      })
      .returning();

    await recordAudit({
      actorId: session.user.id,
      action: "appointment.create",
      entityType: "appointment",
      entityId: newAppointment.id,
      severity: "INFO",
      category: "appointments",
      success: true,
      metadata: {
        appointmentCode: newAppointment.appointmentId,
        patientId: newAppointment.patientId,
        status: newAppointment.status,
      },
    });

    const doctorRecipients = await resolveUserByName(newAppointment.doctorName);
    await recordNotifications({
      recipientIds: doctorRecipients,
      type: "APPOINTMENT",
      title: "Appointment scheduled",
      message: `Appointment ${newAppointment.appointmentId} is scheduled for ${newAppointment.date.toISOString().slice(0, 10)} at ${newAppointment.time}.`,
      action: `/appointments/${newAppointment.id}`,
    });

    return NextResponse.json(newAppointment, { status: 201 });
  } catch (error) {
    console.error("Failed to create appointment:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

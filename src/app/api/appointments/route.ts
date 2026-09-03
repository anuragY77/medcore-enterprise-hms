import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, appointments } from "@/lib/db";
import { appointmentSchema } from "@/lib/validations/appointment";

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
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
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

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

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

    const appointmentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointments);

    const nextNumber = Number(appointmentCount[0]?.count ?? 0) + 1;
    const appointmentId = `APT-${String(nextNumber).padStart(3, "0")}`;

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

    return NextResponse.json(newAppointment, { status: 201 });
  } catch (error) {
    console.error("Failed to create appointment:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

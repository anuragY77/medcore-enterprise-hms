import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, appointments } from "@/lib/db";
import { appointmentSchema } from "@/lib/validations/appointment";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "appointments:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Failed to fetch appointment:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "appointments:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = appointmentSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedAppointment] = await db
      .update(appointments)
      .set({
        ...parsed.data,
        patientId: parsed.data.patientId ?? undefined,
        doctorName: parsed.data.doctorName ?? undefined,
        department: parsed.data.department ?? undefined,
        date: parsed.data.date ? new Date(parsed.data.date) : undefined,
        time: parsed.data.time ?? undefined,
        type: parsed.data.type ?? undefined,
        status: parsed.data.status ?? undefined,
        reason: parsed.data.reason ?? undefined,
        notes: parsed.data.notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    return NextResponse.json(updatedAppointment);
  } catch (error) {
    console.error("Failed to update appointment:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "appointments:delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [deletedAppointment] = await db
      .delete(appointments)
      .where(eq(appointments.id, id))
      .returning();

    if (!deletedAppointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Appointment deleted" });
  } catch (error) {
    console.error("Failed to delete appointment:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

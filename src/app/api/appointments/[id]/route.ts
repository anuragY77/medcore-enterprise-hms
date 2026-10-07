import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, appointments, patients } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { appointmentSchema } from "@/lib/validations/appointment";
import { recordAudit } from "@/lib/audit";
import { resolveUserByName, recordNotifications } from "@/lib/notifications";

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

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

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

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { body: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
    const parsed = appointmentSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Phase 22: a re-pointed patient must exist before it reaches the
    // foreign key (23503 -> 500).
    if (parsed.data.patientId) {
      const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, parsed.data.patientId))
        .limit(1);

      if (!patient) {
        return NextResponse.json({ error: "Patient not found" }, { status: 404 });
      }
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

    const statusChanged = updatedAppointment.status !== existing.status;

    await recordAudit({
      actorId: session.user.id,
      action: "appointment.update",
      entityType: "appointment",
      entityId: updatedAppointment.id,
      severity: "INFO",
      category: "appointments",
      success: true,
      metadata: {
        appointmentCode: updatedAppointment.appointmentId,
        patientId: updatedAppointment.patientId,
        statusFrom: existing.status,
        statusTo: updatedAppointment.status,
      },
    });

    if (statusChanged) {
      const doctorRecipients = await resolveUserByName(updatedAppointment.doctorName);
      await recordNotifications({
        recipientIds: doctorRecipients,
        type: "APPOINTMENT",
        title: "Appointment status updated",
        message: `Appointment ${updatedAppointment.appointmentId} is now ${updatedAppointment.status}.`,
        action: `/appointments/${updatedAppointment.id}`,
      });
    }

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

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [deletedAppointment] = await db
      .delete(appointments)
      .where(eq(appointments.id, id))
      .returning();

    if (!deletedAppointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "appointment.delete",
      entityType: "appointment",
      entityId: deletedAppointment.id,
      severity: "WARNING",
      category: "appointments",
      success: true,
      metadata: {
        appointmentCode: deletedAppointment.appointmentId,
        patientId: deletedAppointment.patientId,
        status: deletedAppointment.status,
      },
    });

    return NextResponse.json({ message: "Appointment deleted" });
  } catch (error) {
    console.error("Failed to delete appointment:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

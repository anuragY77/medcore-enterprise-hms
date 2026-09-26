import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, appointments, consultations } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { consultationSchema } from "@/lib/validations/clinical";
import { recordAudit } from "@/lib/audit";

const ELIGIBLE_STATUSES = ["Scheduled", "Confirmed"];

type ConsultationRow = typeof consultations.$inferSelect;
type AppointmentRow = typeof appointments.$inferSelect;

type StartResult =
  | { kind: "error"; status: number; error: string }
  | { kind: "created"; consultation: ConsultationRow; appointment: AppointmentRow };

export async function POST(
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
    if (!hasPermission(session.user.role, "patients:write")) {
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = consultationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result: StartResult = await db.transaction(async (tx) => {
      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, idParsed.data.id))
        .for("update");

      if (!appointment) {
        return { kind: "error", status: 404, error: "Appointment not found" };
      }

      if (!ELIGIBLE_STATUSES.includes(appointment.status)) {
        return {
          kind: "error",
          status: 409,
          error: "Appointment is not eligible for consultation",
        };
      }

      const [existing] = await tx
        .select({ id: consultations.id })
        .from(consultations)
        .where(eq(consultations.appointmentId, appointment.id))
        .limit(1);

      if (existing) {
        return {
          kind: "error",
          status: 409,
          error: "Consultation already exists for this appointment",
        };
      }

      const [consultation] = await tx
        .insert(consultations)
        .values({
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          doctorName: appointment.doctorName,
          chiefComplaint: parsed.data.chiefComplaint,
          diagnosis: parsed.data.diagnosis,
          treatmentPlan: parsed.data.treatmentPlan || null,
          notes: parsed.data.notes || null,
          followUpDate: parsed.data.followUpDate
            ? new Date(parsed.data.followUpDate)
            : null,
        })
        .returning();

      return { kind: "created", consultation, appointment };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "consultation.start",
      entityType: "consultation",
      entityId: result.consultation.id,
      severity: "INFO",
      category: "consultations",
      success: true,
      metadata: {
        appointmentId: result.appointment.id,
        appointmentCode: result.appointment.appointmentId,
        patientId: result.appointment.patientId,
      },
    });

    return NextResponse.json(result.consultation, { status: 201 });
  } catch (error) {
    console.error("Failed to start consultation from appointment:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

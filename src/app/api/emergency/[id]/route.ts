import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, emergencyCases, patients, staff } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { emergencyCaseSchema } from "@/lib/validations/emergency";
import { recordAudit } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "emergency:read")) {
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

    const [emergencyCase] = await db
      .select()
      .from(emergencyCases)
      .where(eq(emergencyCases.id, id))
      .limit(1);

    if (!emergencyCase) {
      return NextResponse.json({ error: "Emergency case not found" }, { status: 404 });
    }

    return NextResponse.json(emergencyCase);
  } catch (error) {
    console.error("Failed to fetch emergency case:", error);
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
    if (!hasPermission(session.user.role, "emergency:write")) {
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
      .from(emergencyCases)
      .where(eq(emergencyCases.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Emergency case not found" }, { status: 404 });
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
    const parsed = emergencyCaseSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Phase 22: re-pointed references must exist before they reach the
    // foreign keys (23503 -> 500).
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

    if (parsed.data.doctorId) {
      const [doctor] = await db
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.id, parsed.data.doctorId))
        .limit(1);

      if (!doctor) {
        return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
      }
    }

    const [updatedCase] = await db
      .update(emergencyCases)
      .set({
        ...parsed.data,
        patientId: parsed.data.patientId ?? undefined,
        doctorId: parsed.data.doctorId ?? undefined,
        arrivalTime: parsed.data.arrivalTime ? new Date(parsed.data.arrivalTime) : undefined,
        triageLevel: parsed.data.triageLevel ?? undefined,
        status: parsed.data.status ?? undefined,
        chiefComplaint: parsed.data.chiefComplaint ?? undefined,
        diagnosis: parsed.data.diagnosis ?? undefined,
        treatment: parsed.data.treatment ?? undefined,
        notes: parsed.data.notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(emergencyCases.id, id))
      .returning();

    await recordAudit({
      actorId: session.user.id,
      action: "emergency.case.update",
      entityType: "emergency_case",
      entityId: existing.id,
      severity: "WARNING",
      category: "emergency",
      success: true,
      metadata: {
        caseCode: existing.caseId,
        patientId: updatedCase?.patientId ?? existing.patientId,
        statusFrom: existing.status,
        statusTo: updatedCase?.status ?? existing.status,
        triageFrom: existing.triageLevel,
        triageTo: updatedCase?.triageLevel ?? existing.triageLevel,
      },
    });

    return NextResponse.json(updatedCase);
  } catch (error) {
    console.error("Failed to update emergency case:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

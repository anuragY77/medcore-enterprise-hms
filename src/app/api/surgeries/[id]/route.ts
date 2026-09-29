import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, surgeries } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { surgerySchema } from "@/lib/validations/surgery";
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
    if (!hasPermission(session.user.role, "surgery:read")) {
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

    const [surgery] = await db
      .select()
      .from(surgeries)
      .where(eq(surgeries.id, id))
      .limit(1);

    if (!surgery) {
      return NextResponse.json({ error: "Surgery not found" }, { status: 404 });
    }

    return NextResponse.json(surgery);
  } catch (error) {
    console.error("Failed to fetch surgery:", error);
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
    if (!hasPermission(session.user.role, "surgery:write")) {
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
      .from(surgeries)
      .where(eq(surgeries.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Surgery not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = surgerySchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedSurgery] = await db
      .update(surgeries)
      .set({
        ...parsed.data,
        patientId: parsed.data.patientId ?? undefined,
        surgeonId: parsed.data.surgeonId ?? undefined,
        procedureName: parsed.data.procedureName ?? undefined,
        procedureType: parsed.data.procedureType ?? undefined,
        surgeryDate: parsed.data.surgeryDate ? new Date(parsed.data.surgeryDate) : undefined,
        estimatedDuration: parsed.data.estimatedDuration ?? undefined,
        operatingRoom: parsed.data.operatingRoom ?? undefined,
        department: parsed.data.department ?? undefined,
        status: parsed.data.status ?? undefined,
        preOpNotes: parsed.data.preOpNotes ?? undefined,
        postOpNotes: parsed.data.postOpNotes ?? undefined,
        complications: parsed.data.complications ?? undefined,
        anesthesiaType: parsed.data.anesthesiaType ?? undefined,
        notes: parsed.data.notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(surgeries.id, id))
      .returning();

    await recordAudit({
      actorId: session.user.id,
      action: "surgery.update",
      entityType: "surgery",
      entityId: existing.id,
      severity: "WARNING",
      category: "surgery",
      success: true,
      metadata: {
        surgeryCode: existing.surgeryId,
        patientId: updatedSurgery?.patientId ?? existing.patientId,
        surgeonId: updatedSurgery?.surgeonId ?? existing.surgeonId,
        statusFrom: existing.status,
        statusTo: updatedSurgery?.status ?? existing.status,
      },
    });

    return NextResponse.json(updatedSurgery);
  } catch (error) {
    console.error("Failed to update surgery:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

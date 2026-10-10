import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/types/auth";
import { db, beds, patients } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { bedSchema } from "@/lib/validations/bed";

const BED_SELECT = {
  id: beds.id,
  bedId: beds.bedId,
  roomNumber: beds.roomNumber,
  department: beds.department,
  ward: beds.ward,
  type: beds.type,
  status: beds.status,
  patientId: beds.patientId,
  createdAt: beds.createdAt,
  updatedAt: beds.updatedAt,
  patientName: sql<string | null>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
  patientNumber: patients.patientId,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "beds:read")) {
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

    const [bed] = await db
      .select(BED_SELECT)
      .from(beds)
      .leftJoin(patients, eq(beds.patientId, patients.id))
      .where(eq(beds.id, id))
      .limit(1);

    if (!bed) {
      return NextResponse.json({ error: "Bed not found" }, { status: 404 });
    }

    return NextResponse.json(bed);
  } catch (error) {
    console.error("Failed to fetch bed:", error);
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
    if (!hasPermission(session.user.role, "beds:write")) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Validation failed", details: { body: ["Invalid JSON"] } }, { status: 400 });
    }

    const parsed = bedSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(beds)
        .where(eq(beds.id, id))
        .limit(1)
        .for("update");

      if (!existing) {
        return { kind: "error" as const, status: 404, error: "Bed not found" };
      }

      const nextPatientId =
        data.patientId !== undefined ? data.patientId : existing.patientId;
      const nextStatus = data.status !== undefined ? data.status : existing.status;

      if (nextPatientId !== existing.patientId) {
        return {
          kind: "error" as const,
          status: 409,
          error: "Use the bed assignment and discharge workflow to change occupancy",
        };
      }

      if (nextStatus !== existing.status && (nextStatus === "Occupied" || existing.status === "Occupied")) {
        return {
          kind: "error" as const,
          status: 409,
          error: "Use the bed assignment and release workflow to change occupancy",
        };
      }

      const [updatedBed] = await tx
        .update(beds)
        .set({
          roomNumber: data.roomNumber ?? undefined,
          department: data.department ?? undefined,
          ward: data.ward ?? undefined,
          type: data.type ?? undefined,
          status: data.status ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(beds.id, id))
        .returning();

      return { kind: "ok" as const, bed: updatedBed };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "bed.update",
      entityType: "bed",
      entityId: result.bed.id,
      severity: "INFO",
      category: "beds",
      success: true,
      metadata: { bedId: result.bed.bedId, status: result.bed.status },
    });
    return NextResponse.json(result.bed);
  } catch (error) {
    console.error("Failed to update bed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

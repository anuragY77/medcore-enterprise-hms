import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, beds } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { recordAudit } from "@/lib/audit";
import { resolveUsersByDepartmentRole, recordNotifications } from "@/lib/notifications";

export async function POST(
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

    try {
      const body = await request.json();
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return NextResponse.json(
          { error: "Validation failed", details: { body: ["Body must be an object"] } },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Validation failed", details: { body: ["Invalid JSON"] } }, { status: 400 });
    }

    type ReleaseResult =
      | { kind: "error"; status: number; error: string }
      | { kind: "ok"; bed: typeof beds.$inferSelect; previousPatientId: string | null };

    const result: ReleaseResult = await db.transaction(async (tx) => {
      const [bed] = await tx
        .select()
        .from(beds)
        .where(eq(beds.id, id))
        .limit(1)
        .for("update");

      if (!bed) {
        return { kind: "error", status: 404, error: "Bed not found" };
      }

      if (bed.status !== "Occupied" || bed.patientId === null) {
        return { kind: "error", status: 409, error: "Bed is not occupied" };
      }

      const previousPatientId = bed.patientId;

      const [updatedBed] = await tx
        .update(beds)
        .set({
          status: "Available",
          patientId: null,
          updatedAt: new Date(),
        })
        .where(eq(beds.id, id))
        .returning();

      return { kind: "ok", bed: updatedBed, previousPatientId };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "bed.release",
      entityType: "bed",
      entityId: result.bed.id,
      severity: "INFO",
      category: "beds",
      success: true,
      metadata: {
        bedId: result.bed.bedId,
        patientId: result.previousPatientId,
        statusFrom: "Occupied",
        statusTo: result.bed.status,
      },
    });

    const nurseRecipients = await resolveUsersByDepartmentRole("NURSE", result.bed.department);
    await recordNotifications({
      recipientIds: nurseRecipients,
      type: "PATIENT",
      title: "Bed released",
      message: `Bed ${result.bed.bedId} is now available.`,
      action: "/beds",
    });

    return NextResponse.json(result.bed, { status: 200 });
  } catch (error) {
    console.error("Failed to release bed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

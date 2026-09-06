import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, emergencyCases } from "@/lib/db";
import { emergencyCaseSchema } from "@/lib/validations/emergency";

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

    const [existing] = await db
      .select({ id: emergencyCases.id })
      .from(emergencyCases)
      .where(eq(emergencyCases.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Emergency case not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = emergencyCaseSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
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

    return NextResponse.json(updatedCase);
  } catch (error) {
    console.error("Failed to update emergency case:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

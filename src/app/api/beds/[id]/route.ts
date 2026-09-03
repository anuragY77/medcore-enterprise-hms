import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, beds } from "@/lib/db";
import { bedSchema } from "@/lib/validations/bed";

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

    const [bed] = await db
      .select()
      .from(beds)
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

    const [existing] = await db
      .select({ id: beds.id })
      .from(beds)
      .where(eq(beds.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Bed not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = bedSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedBed] = await db
      .update(beds)
      .set({
        ...parsed.data,
        roomNumber: parsed.data.roomNumber ?? undefined,
        department: parsed.data.department ?? undefined,
        ward: parsed.data.ward ?? undefined,
        type: parsed.data.type ?? undefined,
        status: parsed.data.status ?? undefined,
        patientId: parsed.data.patientId ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(beds.id, id))
      .returning();

    return NextResponse.json(updatedBed);
  } catch (error) {
    console.error("Failed to update bed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

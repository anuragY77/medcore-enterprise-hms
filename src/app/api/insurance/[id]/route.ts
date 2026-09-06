import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, insuranceClaims } from "@/lib/db";
import { insuranceClaimSchema } from "@/lib/validations/insurance";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "insurance:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [claim] = await db
      .select()
      .from(insuranceClaims)
      .where(eq(insuranceClaims.id, id))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: "Insurance claim not found" }, { status: 404 });
    }

    return NextResponse.json(claim);
  } catch (error) {
    console.error("Failed to fetch insurance claim:", error);
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
    if (!hasPermission(session.user.role, "insurance:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: insuranceClaims.id })
      .from(insuranceClaims)
      .where(eq(insuranceClaims.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Insurance claim not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = insuranceClaimSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [updatedClaim] = await db
      .update(insuranceClaims)
      .set({
        ...parsed.data,
        patientId: parsed.data.patientId ?? undefined,
        invoiceId: parsed.data.invoiceId ?? undefined,
        providerName: parsed.data.providerName ?? undefined,
        policyNumber: parsed.data.policyNumber ?? undefined,
        claimAmount: parsed.data.claimAmount ?? undefined,
        approvedAmount: parsed.data.approvedAmount ?? undefined,
        status: parsed.data.status ?? undefined,
        diagnosis: parsed.data.diagnosis ?? undefined,
        treatmentCode: parsed.data.treatmentCode ?? undefined,
        submittedDate: parsed.data.submittedDate ? new Date(parsed.data.submittedDate) : undefined,
        processedDate: parsed.data.processedDate ? new Date(parsed.data.processedDate) : undefined,
        denialReason: parsed.data.denialReason ?? undefined,
        notes: parsed.data.notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(insuranceClaims.id, id))
      .returning();

    return NextResponse.json(updatedClaim);
  } catch (error) {
    console.error("Failed to update insurance claim:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

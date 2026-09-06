import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, insuranceClaims } from "@/lib/db";
import { insuranceClaimSchema } from "@/lib/validations/insurance";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "insurance:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const providerName = searchParams.get("providerName") || "";
    const patientId = searchParams.get("patientId") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(insuranceClaims.claimId, `%${query}%`),
          ilike(insuranceClaims.providerName, `%${query}%`),
          ilike(insuranceClaims.policyNumber, `%${query}%`),
          ilike(insuranceClaims.diagnosis, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(insuranceClaims.status, status));
    }

    if (providerName) {
      conditions.push(eq(insuranceClaims.providerName, providerName));
    }

    if (patientId) {
      conditions.push(eq(insuranceClaims.patientId, patientId));
    }

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

    const [countResult, claimsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(insuranceClaims)
        .where(whereClause),
      db
        .select()
        .from(insuranceClaims)
        .where(whereClause)
        .orderBy(sql`${insuranceClaims.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: claimsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch insurance claims:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "insurance:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = insuranceClaimSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const claimCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(insuranceClaims);

    const nextNumber = Number(claimCount[0]?.count ?? 0) + 1;
    const claimId = `CLM-${String(nextNumber).padStart(3, "0")}`;

    const [newClaim] = await db
      .insert(insuranceClaims)
      .values({
        claimId,
        patientId: parsed.data.patientId,
        invoiceId: parsed.data.invoiceId || null,
        providerName: parsed.data.providerName,
        policyNumber: parsed.data.policyNumber,
        claimAmount: parsed.data.claimAmount,
        approvedAmount: parsed.data.approvedAmount ?? null,
        status: parsed.data.status,
        diagnosis: parsed.data.diagnosis || null,
        treatmentCode: parsed.data.treatmentCode || null,
        submittedDate: parsed.data.submittedDate ? new Date(parsed.data.submittedDate) : null,
        processedDate: parsed.data.processedDate ? new Date(parsed.data.processedDate) : null,
        denialReason: parsed.data.denialReason || null,
        notes: parsed.data.notes || null,
      })
      .returning();

    return NextResponse.json(newClaim, { status: 201 });
  } catch (error) {
    console.error("Failed to create insurance claim:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

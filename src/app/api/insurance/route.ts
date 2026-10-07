import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or, ilike, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, insuranceClaims, patients, invoices } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";
import { insuranceClaimSchema } from "@/lib/validations/insurance";
import { isUniqueViolation } from "@/lib/billing";
import { recordAudit } from "@/lib/audit";
import { nextBusinessId } from "@/lib/business-id";
import { resolveUsersByRole, recordNotifications } from "@/lib/notifications";

const ACTIVE_CLAIM_STATUSES = ["Submitted", "Processing", "Approved"];

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

    const filterCheck = z
      .object({
        patientId: z.string().uuid("Invalid patient ID").optional(),
      })
      .safeParse({
        patientId: patientId || undefined,
      });

    if (!filterCheck.success) {
      return NextResponse.json(
        { error: "Validation failed", details: filterCheck.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const pagination = paginationSchema().safeParse({
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });

    if (!pagination.success) {
      return NextResponse.json(
        { error: "Validation failed", details: pagination.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { page, pageSize } = pagination.data;
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { body: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
    const parsed = insuranceClaimSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.approvedAmount !== undefined && data.approvedAmount !== null) {
      if (data.approvedAmount > data.claimAmount) {
        return NextResponse.json(
          { error: "Approved amount cannot exceed claim amount" },
          { status: 400 }
        );
      }

      if (data.status === "Denied" && data.approvedAmount > 0) {
        return NextResponse.json(
          { error: "Denied claims cannot have an approved amount" },
          { status: 400 }
        );
      }
    }

    if (data.status === "Approved" && (data.approvedAmount === undefined || data.approvedAmount === null)) {
      return NextResponse.json(
        { error: "Approved claims require an approved amount" },
        { status: 400 }
      );
    }

    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, data.patientId))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const processedDate = data.processedDate
      ? new Date(data.processedDate)
      : data.status === "Approved" || data.status === "Denied"
        ? new Date()
        : null;

    type PostResult =
      | { kind: "error"; status: number; error: string }
      | { kind: "ok"; claim: typeof insuranceClaims.$inferSelect };

    let result: PostResult | null = null;

    for (let attempt = 0; attempt < 5 && !result; attempt++) {
      try {
        result = await db.transaction(async (tx): Promise<PostResult> => {
          if (data.invoiceId) {
            const [invoice] = await tx
              .select({
                id: invoices.id,
                patientId: invoices.patientId,
                totalAmount: invoices.totalAmount,
              })
              .from(invoices)
              .where(eq(invoices.id, data.invoiceId))
              .limit(1)
              .for("update");

            if (!invoice) {
              return { kind: "error", status: 404, error: "Invoice not found" };
            }

            if (invoice.patientId !== data.patientId) {
              return {
                kind: "error",
                status: 409,
                error: "Invoice does not belong to this patient",
              };
            }

            if (data.claimAmount > invoice.totalAmount) {
              return {
                kind: "error",
                status: 400,
                error: "Claim amount cannot exceed invoice total",
              };
            }

            const [duplicate] = await tx
              .select({ id: insuranceClaims.id })
              .from(insuranceClaims)
              .where(
                and(
                  eq(insuranceClaims.invoiceId, data.invoiceId),
                  inArray(insuranceClaims.status, ACTIVE_CLAIM_STATUSES)
                )
              )
              .limit(1);

            if (duplicate) {
              return {
                kind: "error",
                status: 409,
                error: "An active insurance claim already exists for this invoice",
              };
            }
          }

          const claimId = await nextBusinessId(tx, "CLM");

          const [newClaim] = await tx
            .insert(insuranceClaims)
            .values({
              claimId,
              patientId: data.patientId,
              invoiceId: data.invoiceId || null,
              providerName: data.providerName,
              policyNumber: data.policyNumber,
              claimAmount: data.claimAmount,
              approvedAmount: data.approvedAmount ?? null,
              status: data.status,
              diagnosis: data.diagnosis || null,
              treatmentCode: data.treatmentCode || null,
              submittedDate: data.submittedDate ? new Date(data.submittedDate) : null,
              processedDate,
              denialReason: data.denialReason || null,
              notes: data.notes || null,
            })
            .returning();

          return { kind: "ok", claim: newClaim };
        });
      } catch (error) {
        if (attempt < 4 && isUniqueViolation(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const newClaim = result.claim;

    await recordAudit({
      actorId: session.user.id,
      action: "insurance.claim.create",
      entityType: "insurance_claim",
      entityId: newClaim.id,
      severity: "INFO",
      category: "insurance",
      success: true,
      metadata: {
        claimId: newClaim.claimId,
        patientId: newClaim.patientId,
        invoiceId: newClaim.invoiceId,
        status: newClaim.status,
        claimAmount: newClaim.claimAmount,
      },
    });

    const billingRecipients = await resolveUsersByRole("BILLING");
    await recordNotifications({
      recipientIds: billingRecipients,
      type: "BILLING",
      title: "Insurance claim created",
      message: `Insurance claim ${newClaim.claimId} has been created.`,
      action: "/insurance",
    });

    return NextResponse.json(newClaim, { status: 201 });
  } catch (error) {
    console.error("Failed to create insurance claim:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, insuranceClaims, invoices } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { insuranceClaimSchema } from "@/lib/validations/insurance";
import { recordAudit } from "@/lib/audit";
import { resolveUsersByRole, recordNotifications } from "@/lib/notifications";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Submitted: ["Processing", "Approved", "Denied"],
  Processing: ["Approved", "Denied"],
  Approved: [],
  Denied: [],
};

const ACTIVE_CLAIM_STATUSES = ["Submitted", "Processing", "Approved"];

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

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

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

    const idParsed = idParamSchema.safeParse({ id });

    if (!idParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: idParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = insuranceClaimSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    type PutResult =
      | { kind: "error"; status: number; error: string }
      | {
          kind: "ok";
          claim: typeof insuranceClaims.$inferSelect;
          previous: typeof insuranceClaims.$inferSelect;
        };

    const result: PutResult = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(insuranceClaims)
        .where(eq(insuranceClaims.id, id))
        .limit(1)
        .for("update");

      if (!existing) {
        return { kind: "error", status: 404, error: "Insurance claim not found" };
      }

      if (data.patientId !== undefined && data.patientId !== existing.patientId) {
        return {
          kind: "error",
          status: 409,
          error: "Patient cannot be changed on an existing insurance claim",
        };
      }

      if (
        data.invoiceId !== undefined &&
        data.invoiceId !== existing.invoiceId &&
        existing.invoiceId !== null
      ) {
        return {
          kind: "error",
          status: 409,
          error: "Invoice link cannot be changed on an existing insurance claim",
        };
      }

      const finalStatus = data.status ?? existing.status;
      const claimAmount = data.claimAmount ?? existing.claimAmount;
      const approvedAmount =
        data.approvedAmount !== undefined ? data.approvedAmount : existing.approvedAmount;

      const invoiceId = data.invoiceId !== undefined ? data.invoiceId : existing.invoiceId;
      const isRelink = invoiceId !== null && (!existing.invoiceId || invoiceId !== existing.invoiceId);

      if (invoiceId) {
        const [invoice] = await tx
          .select({
            id: invoices.id,
            patientId: invoices.patientId,
            totalAmount: invoices.totalAmount,
          })
          .from(invoices)
          .where(eq(invoices.id, invoiceId))
          .limit(1)
          .for("update");

        if (!invoice) {
          return { kind: "error", status: 404, error: "Invoice not found" };
        }

        if (invoice.patientId !== existing.patientId) {
          return {
            kind: "error",
            status: 409,
            error: "Invoice does not belong to this patient",
          };
        }

        if (claimAmount > invoice.totalAmount) {
          return {
            kind: "error",
            status: 400,
            error: "Claim amount cannot exceed invoice total",
          };
        }

        if (isRelink) {
          const [duplicate] = await tx
            .select({ id: insuranceClaims.id })
            .from(insuranceClaims)
            .where(
              and(
                eq(insuranceClaims.invoiceId, invoiceId),
                ne(insuranceClaims.id, existing.id),
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
      }

      if (approvedAmount !== null) {
        if (approvedAmount > claimAmount) {
          return {
            kind: "error",
            status: 400,
            error: "Approved amount cannot exceed claim amount",
          };
        }

        if (finalStatus === "Denied" && approvedAmount > 0) {
          return {
            kind: "error",
            status: 400,
            error: "Denied claims cannot have an approved amount",
          };
        }
      }

      if (finalStatus === "Approved" && approvedAmount === null) {
        return {
          kind: "error",
          status: 400,
          error: "Approved claims require an approved amount",
        };
      }

      if (finalStatus !== existing.status) {
        const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(finalStatus)) {
          return {
            kind: "error",
            status: 409,
            error: `Invalid status transition from ${existing.status} to ${finalStatus}`,
          };
        }
      }

      let processedDate: Date | null;
      if (data.processedDate) {
        processedDate = new Date(data.processedDate);
      } else if (existing.processedDate) {
        processedDate = existing.processedDate;
      } else if (finalStatus === "Approved" || finalStatus === "Denied") {
        processedDate = new Date();
      } else {
        processedDate = null;
      }

      const [updatedClaim] = await tx
        .update(insuranceClaims)
        .set({
          claimAmount,
          approvedAmount,
          status: finalStatus,
          invoiceId: invoiceId || null,
          providerName: data.providerName ?? existing.providerName,
          policyNumber: data.policyNumber ?? existing.policyNumber,
          diagnosis: data.diagnosis !== undefined ? data.diagnosis : existing.diagnosis,
          treatmentCode:
            data.treatmentCode !== undefined ? data.treatmentCode : existing.treatmentCode,
          submittedDate: data.submittedDate
            ? new Date(data.submittedDate)
            : existing.submittedDate,
          processedDate,
          denialReason: data.denialReason !== undefined ? data.denialReason : existing.denialReason,
          notes: data.notes !== undefined ? data.notes : existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(insuranceClaims.id, id))
        .returning();

      return { kind: "ok", claim: updatedClaim, previous: existing };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "insurance.claim.update",
      entityType: "insurance_claim",
      entityId: result.claim.id,
      severity: "INFO",
      category: "insurance",
      success: true,
      metadata: {
        claimId: result.claim.claimId,
        patientId: result.claim.patientId,
        invoiceId: result.claim.invoiceId,
        statusFrom: result.previous.status,
        statusTo: result.claim.status,
        claimAmount: result.claim.claimAmount,
        approvedAmount: result.claim.approvedAmount,
      },
    });

    if (result.previous.status !== result.claim.status) {
      const billingRecipients = await resolveUsersByRole("BILLING");
      await recordNotifications({
        recipientIds: billingRecipients,
        type: "BILLING",
        title: "Insurance claim status updated",
        message: `Insurance claim ${result.claim.claimId} is now ${result.claim.status}.`,
        action: "/insurance",
      });
    }

    return NextResponse.json(result.claim);
  } catch (error) {
    console.error("Failed to update insurance claim:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

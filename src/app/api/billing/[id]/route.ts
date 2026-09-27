import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, invoices, insuranceClaims, appointments } from "@/lib/db";
import { idParamSchema } from "@/lib/validations/common";
import { invoiceSchema } from "@/lib/validations/billing";
import { computeInvoiceTotal } from "@/lib/billing";
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
    if (!hasPermission(session.user.role, "billing:read")) {
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

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
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
    if (!hasPermission(session.user.role, "billing:write")) {
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
    const parsed = invoiceSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    type PutResult =
      | { kind: "error"; status: number; error: string }
      | { kind: "ok"; invoice: typeof invoices.$inferSelect };

    const result: PutResult = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1)
        .for("update");

      if (!existing) {
        return { kind: "error", status: 404, error: "Invoice not found" };
      }

      if (data.patientId !== undefined && data.patientId !== existing.patientId) {
        return {
          kind: "error",
          status: 409,
          error: "Patient cannot be changed on an existing invoice",
        };
      }

      const merged = {
        appointmentId:
          data.appointmentId !== undefined ? data.appointmentId : existing.appointmentId,
        description: data.description !== undefined ? data.description : existing.description,
        subtotal: data.subtotal ?? existing.subtotal,
        taxAmount: data.taxAmount !== undefined ? data.taxAmount : existing.taxAmount,
        discountAmount:
          data.discountAmount !== undefined ? data.discountAmount : existing.discountAmount,
        paidAmount: data.paidAmount !== undefined ? data.paidAmount : existing.paidAmount,
        status: data.status ?? existing.status,
        paymentMethod:
          data.paymentMethod !== undefined ? data.paymentMethod : existing.paymentMethod,
        paidDate:
          data.paidDate !== undefined
            ? data.paidDate
            : existing.paidDate
              ? existing.paidDate.toISOString()
              : null,
        dueDate:
          data.dueDate !== undefined
            ? data.dueDate
            : existing.dueDate
              ? existing.dueDate.toISOString()
              : null,
        notes: data.notes !== undefined ? data.notes : existing.notes,
      };

      if (merged.appointmentId) {
        const [appointment] = await tx
          .select({ id: appointments.id, patientId: appointments.patientId })
          .from(appointments)
          .where(eq(appointments.id, merged.appointmentId))
          .limit(1);

        if (!appointment) {
          return { kind: "error", status: 404, error: "Appointment not found" };
        }

        if (appointment.patientId !== existing.patientId) {
          return {
            kind: "error",
            status: 409,
            error: "Appointment does not belong to this patient",
          };
        }
      }

      const totalAmount = computeInvoiceTotal(
        merged.subtotal,
        merged.taxAmount,
        merged.discountAmount
      );

      if (totalAmount < 0) {
        return {
          kind: "error",
          status: 400,
          error: "Discount cannot exceed subtotal plus tax",
        };
      }

      const paidAmount = merged.paidAmount ?? null;

      if (paidAmount !== null && paidAmount > totalAmount) {
        return {
          kind: "error",
          status: 400,
          error: "Paid amount cannot exceed total amount",
        };
      }

      if (merged.status === "Paid" && (paidAmount === null || paidAmount < totalAmount)) {
        return {
          kind: "error",
          status: 400,
          error: "Paid invoices require paid amount at least equal to total amount",
        };
      }

      const [linkedClaims] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(insuranceClaims)
        .where(
          sql`${insuranceClaims.invoiceId} = ${existing.id} AND ${insuranceClaims.claimAmount} > ${totalAmount}`
        );

      if (Number(linkedClaims?.count ?? 0) > 0) {
        return {
          kind: "error",
          status: 409,
          error: "Invoice total cannot go below a linked insurance claim amount",
        };
      }

      const [updatedInvoice] = await tx
        .update(invoices)
        .set({
          appointmentId: merged.appointmentId || null,
          description: merged.description ?? null,
          subtotal: merged.subtotal,
          taxAmount: merged.taxAmount ?? null,
          discountAmount: merged.discountAmount ?? null,
          totalAmount,
          paidAmount,
          status: merged.status,
          paymentMethod: merged.paymentMethod ?? null,
          paidDate: merged.paidDate ? new Date(merged.paidDate) : null,
          dueDate: merged.dueDate ? new Date(merged.dueDate) : null,
          notes: merged.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();

      return { kind: "ok", invoice: updatedInvoice };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "billing.invoice.update",
      entityType: "invoice",
      entityId: result.invoice.id,
      severity: "INFO",
      category: "billing",
      success: true,
      metadata: {
        invoiceId: result.invoice.invoiceId,
        patientId: result.invoice.patientId,
        status: result.invoice.status,
        totalAmount: result.invoice.totalAmount,
      },
    });

    return NextResponse.json(result.invoice);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "billing:delete")) {
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

    type DeleteResult =
      | { kind: "error"; status: number; error: string }
      | { kind: "ok"; invoice: typeof invoices.$inferSelect };

    const result: DeleteResult = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1)
        .for("update");

      if (!existing) {
        return { kind: "error", status: 404, error: "Invoice not found" };
      }

      const [linkedClaims] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(insuranceClaims)
        .where(eq(insuranceClaims.invoiceId, existing.id));

      if (Number(linkedClaims?.count ?? 0) > 0) {
        return {
          kind: "error",
          status: 409,
          error: "Cannot delete an invoice with linked insurance claims",
        };
      }

      const [deletedInvoice] = await tx
        .delete(invoices)
        .where(eq(invoices.id, id))
        .returning();

      if (!deletedInvoice) {
        return { kind: "error", status: 404, error: "Invoice not found" };
      }

      return { kind: "ok", invoice: deletedInvoice };
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "billing.invoice.delete",
      entityType: "invoice",
      entityId: result.invoice.id,
      severity: "INFO",
      category: "billing",
      success: true,
      metadata: {
        invoiceId: result.invoice.invoiceId,
        patientId: result.invoice.patientId,
        status: result.invoice.status,
        totalAmount: result.invoice.totalAmount,
      },
    });

    return NextResponse.json({ message: "Invoice deleted" });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

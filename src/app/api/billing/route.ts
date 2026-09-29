import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, invoices, patients, appointments } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";
import { invoiceSchema } from "@/lib/validations/billing";
import { computeInvoiceTotal, isUniqueViolation } from "@/lib/billing";
import { recordAudit } from "@/lib/audit";
import { resolveUsersByRole, recordNotifications } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "billing:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const patientId = searchParams.get("patientId") || "";
    const paymentMethod = searchParams.get("paymentMethod") || "";

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
          ilike(invoices.invoiceId, `%${query}%`),
          ilike(invoices.description, `%${query}%`),
          ilike(invoices.paymentMethod, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(invoices.status, status));
    }

    if (patientId) {
      conditions.push(eq(invoices.patientId, patientId));
    }

    if (paymentMethod) {
      conditions.push(eq(invoices.paymentMethod, paymentMethod));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, invoicesList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(whereClause),
      db
        .select()
        .from(invoices)
        .where(whereClause)
        .orderBy(sql`${invoices.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: invoicesList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "billing:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = invoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, data.patientId))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (data.appointmentId) {
      const [appointment] = await db
        .select({ id: appointments.id, patientId: appointments.patientId })
        .from(appointments)
        .where(eq(appointments.id, data.appointmentId))
        .limit(1);

      if (!appointment) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      if (appointment.patientId !== data.patientId) {
        return NextResponse.json(
          { error: "Appointment does not belong to this patient" },
          { status: 409 }
        );
      }
    }

    const totalAmount = computeInvoiceTotal(data.subtotal, data.taxAmount, data.discountAmount);

    if (totalAmount < 0) {
      return NextResponse.json(
        { error: "Discount cannot exceed subtotal plus tax" },
        { status: 400 }
      );
    }

    const paidAmount = data.paidAmount ?? null;

    if (paidAmount !== null && paidAmount > totalAmount) {
      return NextResponse.json(
        { error: "Paid amount cannot exceed total amount" },
        { status: 400 }
      );
    }

    if (data.status === "Paid" && (paidAmount === null || paidAmount < totalAmount)) {
      return NextResponse.json(
        { error: "Paid invoices require paid amount at least equal to total amount" },
        { status: 400 }
      );
    }

    let newInvoice: (typeof invoices.$inferSelect) | undefined;

    for (let attempt = 0; attempt < 5 && !newInvoice; attempt++) {
      const invoiceCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices);

      const nextNumber = Number(invoiceCount[0]?.count ?? 0) + 1;
      const invoiceId = `INV-${String(nextNumber).padStart(3, "0")}`;

      try {
        [newInvoice] = await db
          .insert(invoices)
          .values({
            invoiceId,
            patientId: data.patientId,
            appointmentId: data.appointmentId || null,
            description: data.description || null,
            subtotal: data.subtotal,
            taxAmount: data.taxAmount ?? null,
            discountAmount: data.discountAmount ?? null,
            totalAmount,
            paidAmount,
            status: data.status,
            paymentMethod: data.paymentMethod || null,
            paidDate: data.paidDate ? new Date(data.paidDate) : null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            notes: data.notes || null,
          })
          .returning();
      } catch (error) {
        if (attempt < 4 && isUniqueViolation(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!newInvoice) {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    await recordAudit({
      actorId: session.user.id,
      action: "billing.invoice.create",
      entityType: "invoice",
      entityId: newInvoice.id,
      severity: "INFO",
      category: "billing",
      success: true,
      metadata: {
        invoiceId: newInvoice.invoiceId,
        patientId: newInvoice.patientId,
        status: newInvoice.status,
        totalAmount: newInvoice.totalAmount,
      },
    });

    const billingRecipients = await resolveUsersByRole("BILLING");
    await recordNotifications({
      recipientIds: billingRecipients,
      type: "BILLING",
      title: "Invoice created",
      message: `Invoice ${newInvoice.invoiceId} has been created.`,
      action: "/billing",
    });

    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

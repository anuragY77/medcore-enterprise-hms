import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, invoices } from "@/lib/db";
import { invoiceSchema } from "@/lib/validations/billing";

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
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
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

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

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

    const invoiceCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices);

    const nextNumber = Number(invoiceCount[0]?.count ?? 0) + 1;
    const invoiceId = `INV-${String(nextNumber).padStart(3, "0")}`;

    const [newInvoice] = await db
      .insert(invoices)
      .values({
        invoiceId,
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId || null,
        description: parsed.data.description || null,
        subtotal: parsed.data.subtotal,
        taxAmount: parsed.data.taxAmount ?? null,
        discountAmount: parsed.data.discountAmount ?? null,
        totalAmount: parsed.data.totalAmount,
        paidAmount: parsed.data.paidAmount ?? null,
        status: parsed.data.status,
        paymentMethod: parsed.data.paymentMethod || null,
        paidDate: parsed.data.paidDate ? new Date(parsed.data.paidDate) : null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        notes: parsed.data.notes || null,
      })
      .returning();

    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

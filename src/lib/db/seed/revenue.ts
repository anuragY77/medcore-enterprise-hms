import { insuranceClaims, invoices } from "@/lib/db/schema";
import {
  DIAGNOSES,
  INVOICE_DESCRIPTIONS,
} from "./datasets";
import { createRng, deterministicUuid, pick } from "./ids";
import { daysFrom, type SeedContext, type SeedCounts, type Tx } from "./types";

const pad3 = (n: number): string => String(n).padStart(3, "0");

const round2 = (n: number): number => Math.round(n * 100) / 100;
const paymentMethods = ["Cash", "Credit Card", "Debit Card", "Insurance", "Bank Transfer", "Check", "Online"];
const denialReasons = [
  "Pre-existing condition not disclosed at enrolment.",
  "Policy lapsed at the date of service.",
  "Treatment outside the policy network coverage.",
];

/**
 * 110 invoices (count-compatible INV-001…) plus up to 45 insurance claims
 * linked to insured patients' invoices with matching policy numbers.
 */
export async function seedRevenue(
  tx: Tx,
  ctx: SeedContext
): Promise<SeedCounts> {
  const rng = createRng(0x9e9e9e);
  const now = ctx.now;
  const planByPatient = new Map(ctx.plans.map((p) => [p.patientId, p]));

  const invoiceRows: {
    invoiceId: string;
    id: string;
    patientId: string;
    totalAmount: number;
    createdAt: Date;
  }[] = [];

  const totalInvoices = 110;
  for (let i = 0; i < totalInvoices; i++) {
    const invoiceId = `INV-${pad3(i + 1)}`;
    const plan = ctx.plans[(i * 7) % ctx.plans.length];
    const patientRowId = ctx.patients.get(plan.patientId)!;
    const patientAppointments = ctx.appointmentsByPatient.get(plan.patientId) ?? [];
    const pastAppointments = patientAppointments.filter(
      (a) => a.date < now && a.status !== "Cancelled"
    );
    const linked =
      pastAppointments.length > 0 && i % 3 !== 0
        ? pastAppointments[i % pastAppointments.length]
        : null;

    const subtotal = round2(800 + Math.floor(rng() * 24000));
    const taxAmount = i % 3 === 0 ? round2(subtotal * 0.18) : 0;
    const discountAmount = i % 5 === 0 ? round2(subtotal * 0.1) : 0;
    const totalAmount = round2(subtotal + taxAmount - discountAmount);

    const createdAt = daysFrom(now, -1 - Math.floor(rng() * 74));
    const dueDate = daysFrom(createdAt, 15);
    const bucket = rng();
    const status =
      bucket < 0.55
        ? "Paid"
        : bucket < 0.85
          ? "Pending"
          : bucket < 0.95
            ? // An invoice is only overdue once its due date has passed;
              // otherwise it stays pending like any other open bill.
              dueDate < now
              ? "Overdue"
              : "Pending"
            : "Cancelled";
    const paid = status === "Paid";
    const paidAmount = paid
      ? totalAmount
      : status === "Pending" && i % 4 === 0
        ? round2(totalAmount * 0.4)
        : 0;
    const paidDate = paid
      ? new Date(
          Math.min(
            daysFrom(createdAt, 1 + Math.floor(rng() * 12)).getTime(),
            now.getTime()
          )
        )
      : null;

    const rows = await tx
      .insert(invoices)
      .values({
        id: deterministicUuid("invoice", invoiceId),
        invoiceId,
        patientId: patientRowId,
        appointmentId: linked ? linked.id : null,
        description: `${pick(rng, INVOICE_DESCRIPTIONS)} — ${plan.department}`,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        paidAmount,
        status,
        paymentMethod: paid ? pick(rng, paymentMethods) : null,
        paidDate,
        dueDate,
        notes: i % 6 === 0 ? "Insurance reimbursement pending." : null,
        createdAt,
        updatedAt: createdAt,
      })
      .onConflictDoUpdate({
        target: invoices.invoiceId,
        set: {
          patientId: patientRowId,
          appointmentId: linked ? linked.id : null,
          description: `${pick(rng, INVOICE_DESCRIPTIONS)} — ${plan.department}`,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          paidAmount,
          status,
          paymentMethod: paid ? pick(rng, paymentMethods) : null,
          paidDate,
          dueDate,
          updatedAt: new Date(),
        },
      })
      .returning({ id: invoices.id });

    ctx.invoices.set(invoiceId, rows[0].id);
    invoiceRows.push({
      invoiceId,
      id: rows[0].id,
      patientId: plan.patientId,
      totalAmount,
      createdAt,
    });
  }

  // --- Insurance claims (only for insured patients, linked to their bills)
  const insuredInvoices = invoiceRows.filter(
    (row) => planByPatient.get(row.patientId)?.insured
  );
  const totalClaims = Math.min(45, insuredInvoices.length);
  for (let i = 0; i < totalClaims; i++) {
    const claimId = `CLM-${pad3(i + 1)}`;
    const invoice = insuredInvoices[i % insuredInvoices.length];
    const plan = planByPatient.get(invoice.patientId)!;
    const bucket = rng();
    const status =
      bucket < 0.45 ? "Approved" : bucket < 0.65 ? "Processing" : bucket < 0.85 ? "Submitted" : "Denied";
    const submittedDate = daysFrom(invoice.createdAt, 1);
    const processedDecision =
      status === "Approved" || status === "Denied"
        ? daysFrom(submittedDate, 3 + Math.floor(rng() * 11))
        : null;
    // A final decision always carries a processed date (the app sets it on
    // every Approved/Denied write), so clamp a future-dated decision to the
    // seed timestamp instead of dropping it.
    const processed = processedDecision
      ? processedDecision > now
        ? now
        : processedDecision
      : null;
    const approvedAmount =
      status === "Approved"
        ? round2(invoice.totalAmount * (0.7 + rng() * 0.3))
        : null;

    await tx
      .insert(insuranceClaims)
      .values({
        id: deterministicUuid("claim", claimId),
        claimId,
        patientId: ctx.patients.get(plan.patientId)!,
        invoiceId: invoice.id,
        providerName: plan.insuranceProvider!,
        policyNumber: plan.insurancePolicyNumber!,
        claimAmount: invoice.totalAmount,
        approvedAmount,
        status,
        diagnosis: pick(rng, DIAGNOSES),
        treatmentCode: `OP-${new Date().getFullYear()}-${1000 + i}`,
        submittedDate,
        processedDate: processed,
        denialReason: status === "Denied" ? pick(rng, denialReasons) : null,
        notes: i % 4 === 0 ? "Cashless request raised with the TPA." : null,
        createdAt: submittedDate,
        updatedAt: processed ?? submittedDate,
      })
      .onConflictDoUpdate({
        target: insuranceClaims.claimId,
        set: {
          patientId: ctx.patients.get(plan.patientId)!,
          invoiceId: invoice.id,
          providerName: plan.insuranceProvider!,
          policyNumber: plan.insurancePolicyNumber!,
          claimAmount: invoice.totalAmount,
          approvedAmount,
          status,
          diagnosis: pick(rng, DIAGNOSES),
          submittedDate,
          processedDate: processed,
          denialReason: status === "Denied" ? pick(rng, denialReasons) : null,
          updatedAt: new Date(),
        },
      });
  }

  return { invoices: totalInvoices, insuranceClaims: totalClaims };
}

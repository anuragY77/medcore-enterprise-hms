import { z } from "zod";
import { optionalDateFieldSchema } from "./common";

// Phase 22: money columns are real (float4, max ~3.4e38); values beyond that
// range make PostgreSQL raise 22003 -> 500. 1e9 per field is far beyond any
// realistic invoice while staying well inside the column range.
const MAX_MONEY = 1000000000;

export const invoiceSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  appointmentId: z.string().uuid("Invalid appointment ID").optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  subtotal: z
    .number({ message: "Subtotal must be a number" })
    .min(0, "Subtotal must be non-negative")
    .max(MAX_MONEY, "Subtotal is too large"),
  taxAmount: z
    .number({ message: "Tax amount must be a number" })
    .min(0, "Tax amount must be non-negative")
    .max(MAX_MONEY, "Tax amount is too large")
    .optional()
    .nullable(),
  discountAmount: z
    .number({ message: "Discount amount must be a number" })
    .min(0, "Discount amount must be non-negative")
    .max(MAX_MONEY, "Discount amount is too large")
    .optional()
    .nullable(),
  totalAmount: z
    .number({ message: "Total amount must be a number" })
    .min(0, "Total amount must be non-negative")
    .max(MAX_MONEY, "Total amount is too large"),
  paidAmount: z
    .number({ message: "Paid amount must be a number" })
    .min(0, "Paid amount must be non-negative")
    .max(MAX_MONEY, "Paid amount is too large")
    .optional()
    .nullable(),
  status: z.enum(["Pending", "Paid", "Overdue", "Cancelled"], {
    message: "Status is required",
  }),
  paymentMethod: z.string().max(50).optional().nullable(),
  paidDate: optionalDateFieldSchema,
  dueDate: optionalDateFieldSchema,
  notes: z.string().max(20000).optional().nullable(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

export const invoiceSearchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(["All", "Pending", "Paid", "Overdue", "Cancelled"]).default("All"),
  patientId: z.string().optional(),
  paymentMethod: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).max(100000).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type InvoiceSearchData = z.infer<typeof invoiceSearchSchema>;

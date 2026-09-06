import { z } from "zod";

export const invoiceSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  appointmentId: z.string().uuid("Invalid appointment ID").optional().nullable(),
  description: z.string().optional().nullable(),
  subtotal: z
    .number({ message: "Subtotal must be a number" })
    .min(0, "Subtotal must be non-negative"),
  taxAmount: z
    .number({ message: "Tax amount must be a number" })
    .min(0, "Tax amount must be non-negative")
    .optional()
    .nullable(),
  discountAmount: z
    .number({ message: "Discount amount must be a number" })
    .min(0, "Discount amount must be non-negative")
    .optional()
    .nullable(),
  totalAmount: z
    .number({ message: "Total amount must be a number" })
    .min(0, "Total amount must be non-negative"),
  paidAmount: z
    .number({ message: "Paid amount must be a number" })
    .min(0, "Paid amount must be non-negative")
    .optional()
    .nullable(),
  status: z.enum(["Pending", "Paid", "Overdue", "Cancelled"], {
    message: "Status is required",
  }),
  paymentMethod: z.string().max(50).optional().nullable(),
  paidDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

export const invoiceSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Pending", "Paid", "Overdue", "Cancelled"]).default("All"),
  patientId: z.string().optional(),
  paymentMethod: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type InvoiceSearchData = z.infer<typeof invoiceSearchSchema>;

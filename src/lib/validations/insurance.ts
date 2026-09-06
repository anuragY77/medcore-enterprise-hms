import { z } from "zod";

export const insuranceClaimSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  invoiceId: z.string().uuid("Invalid invoice ID").optional().nullable(),
  providerName: z.string().min(1, "Provider name is required").max(200),
  policyNumber: z.string().min(1, "Policy number is required").max(100),
  claimAmount: z
    .number({ message: "Claim amount must be a number" })
    .min(0, "Claim amount must be non-negative"),
  approvedAmount: z
    .number({ message: "Approved amount must be a number" })
    .min(0, "Approved amount must be non-negative")
    .optional()
    .nullable(),
  status: z.enum(["Submitted", "Processing", "Approved", "Denied"], {
    message: "Status is required",
  }),
  diagnosis: z.string().optional().nullable(),
  treatmentCode: z.string().max(100).optional().nullable(),
  submittedDate: z.string().optional(),
  processedDate: z.string().optional(),
  denialReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type InsuranceClaimFormData = z.infer<typeof insuranceClaimSchema>;

export const insuranceClaimSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Submitted", "Processing", "Approved", "Denied"]).default("All"),
  providerName: z.string().optional(),
  patientId: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type InsuranceClaimSearchData = z.infer<typeof insuranceClaimSearchSchema>;

import "@/lib/zod-csp";

import { z } from "zod";
import { optionalDateFieldSchema } from "./common";

// Phase 22: claim amounts live in real (float4) columns; keep inputs inside
// the column range so PostgreSQL cannot raise 22003 (surfaced as 500).
const MAX_MONEY = 1000000000;

export const insuranceClaimSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  invoiceId: z.string().uuid("Invalid invoice ID").optional().nullable(),
  providerName: z.string().min(1, "Provider name is required").max(200),
  policyNumber: z.string().min(1, "Policy number is required").max(100),
  claimAmount: z
    .number({ message: "Claim amount must be a number" })
    .min(0, "Claim amount must be non-negative")
    .max(MAX_MONEY, "Claim amount is too large"),
  approvedAmount: z
    .number({ message: "Approved amount must be a number" })
    .min(0, "Approved amount must be non-negative")
    .max(MAX_MONEY, "Approved amount is too large")
    .optional()
    .nullable(),
  status: z.enum(["Submitted", "Processing", "Approved", "Denied"], {
    message: "Status is required",
  }),
  diagnosis: z.string().max(20000).optional().nullable(),
  treatmentCode: z.string().max(100).optional().nullable(),
  submittedDate: optionalDateFieldSchema,
  processedDate: optionalDateFieldSchema,
  denialReason: z.string().max(20000).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
});

export type InsuranceClaimFormData = z.infer<typeof insuranceClaimSchema>;

export const insuranceClaimSearchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(["All", "Submitted", "Processing", "Approved", "Denied"]).default("All"),
  providerName: z.string().optional(),
  patientId: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).max(100000).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type InsuranceClaimSearchData = z.infer<typeof insuranceClaimSearchSchema>;

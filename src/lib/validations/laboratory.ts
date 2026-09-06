import { z } from "zod";

export const labTestSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  consultationId: z.string().uuid("Invalid consultation ID").optional().nullable(),
  testName: z.string().min(1, "Test name is required").max(200),
  category: z.string().min(1, "Category is required").max(100),
  orderedBy: z.string().max(200).optional(),
  status: z.enum(["Pending", "In Progress", "Completed"], {
    message: "Status is required",
  }),
  result: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  testDate: z.string().min(1, "Test date is required"),
  completedAt: z.string().optional(),
});

export type LabTestFormData = z.infer<typeof labTestSchema>;

export const labTestSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Pending", "In Progress", "Completed"]).default("All"),
  category: z.string().optional(),
  patientId: z.string().optional(),
  orderedBy: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type LabTestSearchData = z.infer<typeof labTestSearchSchema>;

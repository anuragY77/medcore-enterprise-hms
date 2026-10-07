import { z } from "zod";
import { dateFieldSchema, optionalDateFieldSchema } from "./common";

export const labTestSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  consultationId: z.string().uuid("Invalid consultation ID").optional().nullable(),
  testName: z.string().min(1, "Test name is required").max(200),
  category: z.string().min(1, "Category is required").max(100),
  orderedBy: z.string().max(200).optional(),
  status: z.enum(["Pending", "In Progress", "Completed"], {
    message: "Status is required",
  }),
  result: z.string().max(20000).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
  testDate: dateFieldSchema("Test date is required"),
  completedAt: optionalDateFieldSchema,
});

export type LabTestFormData = z.infer<typeof labTestSchema>;

export const labTestSearchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(["All", "Pending", "In Progress", "Completed"]).default("All"),
  category: z.string().optional(),
  patientId: z.string().optional(),
  orderedBy: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).max(100000).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type LabTestSearchData = z.infer<typeof labTestSearchSchema>;

export const labResultEntrySchema = z.object({
  result: z
    .string()
    .max(20000, "Result is too long")
    .refine((value) => value.trim().length > 0, { message: "Result is required" }),
});

export type LabResultEntryData = z.infer<typeof labResultEntrySchema>;

export const labTestUpdateSchema = z.object({
  testName: z.string().min(1, "Test name is required").max(200).optional(),
  category: z.string().min(1, "Category is required").max(100).optional(),
  orderedBy: z.string().max(200).optional(),
  notes: z.string().max(20000).optional(),
  testDate: dateFieldSchema("Test date is required").optional(),
});

export type LabTestUpdateData = z.infer<typeof labTestUpdateSchema>;

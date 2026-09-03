import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
  description: z.string().optional(),
  headDoctor: z.string().optional(),
  phone: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
  totalBeds: z
    .number({ message: "Total beds must be a number" })
    .int()
    .min(0, "Total beds must be non-negative")
    .optional()
    .nullable(),
  status: z.enum(["Active", "Inactive"], {
    message: "Status is required",
  }),
});

export type DepartmentFormData = z.infer<typeof departmentSchema>;

export const departmentSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Active", "Inactive"]).default("All"),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type DepartmentSearchData = z.infer<typeof departmentSearchSchema>;

import "@/lib/zod-csp";

import { z } from "zod";
import { optionalDateFieldSchema } from "./common";

export const staffSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address").max(200),
  phone: z.string().min(1, "Phone is required").max(20),
  role: z.string().min(1, "Role is required").max(50),
  department: z.string().min(1, "Department is required").max(100),
  specialization: z.string().max(200).optional(),
  qualification: z.string().max(200).optional(),
  experience: z
    .number({ message: "Must be a number" })
    .int()
    .min(0)
    .max(2147483647, "Experience is too large")
    .optional()
    .nullable(),
  status: z.enum(["Active", "Inactive", "On Leave"], {
    message: "Status is required",
  }),
  joiningDate: optionalDateFieldSchema,
});

export type StaffFormData = z.infer<typeof staffSchema>;

export const staffSearchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(["All", "Active", "Inactive", "On Leave"]).default("All"),
  department: z.string().optional(),
  role: z.string().optional(),
});

export type StaffSearchData = z.infer<typeof staffSearchSchema>;

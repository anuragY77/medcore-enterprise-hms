import { z } from "zod";

export const staffSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").max(20),
  role: z.string().min(1, "Role is required"),
  department: z.string().min(1, "Department is required"),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.number({ message: "Must be a number" }).int().min(0).optional().nullable(),
  status: z.enum(["Active", "Inactive", "On Leave"], {
    message: "Status is required",
  }),
  joiningDate: z.string().optional(),
});

export type StaffFormData = z.infer<typeof staffSchema>;

export const staffSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Active", "Inactive", "On Leave"]).default("All"),
  department: z.string().optional(),
  role: z.string().optional(),
});

export type StaffSearchData = z.infer<typeof staffSearchSchema>;

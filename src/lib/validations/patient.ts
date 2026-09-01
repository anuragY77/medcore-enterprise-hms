import { z } from "zod";

export const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["Male", "Female", "Other"], {
    message: "Gender is required",
  }),
  bloodGroup: z.string().optional(),
  phone: z.string().min(1, "Phone is required").max(20),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  attendingDoctor: z.string().min(1, "Attending doctor is required"),
  status: z.enum(["Active", "Discharged", "Critical", "In Progress"]).default("Active"),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;

export const patientSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Active", "Discharged", "Critical", "In Progress"]).default("All"),
  department: z.string().optional(),
});

export type PatientSearchData = z.infer<typeof patientSearchSchema>;

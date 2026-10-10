import "@/lib/zod-csp";

import { z } from "zod";
import { dateFieldSchema } from "./common";

export const patientDateOfBirthSchema = dateFieldSchema(
  "Date of birth is required"
);

export const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  dateOfBirth: patientDateOfBirthSchema,
  gender: z.enum(["Male", "Female", "Other"], {
    message: "Gender is required",
  }),
  // Phase 22: upper bounds mirror the column widths below so oversized input
  // is rejected with 400 instead of reaching PostgreSQL (22001 -> 500).
  bloodGroup: z.string().max(5).optional(),
  phone: z.string().min(1, "Phone is required").max(20),
  email: z.string().email("Invalid email address").max(200).optional().or(z.literal("")),
  address: z.string().max(20000).optional(),
  department: z.string().min(1, "Department is required").max(100),
  attendingDoctor: z.string().min(1, "Attending doctor is required").max(200),
  status: z.enum(["Active", "Discharged", "Critical", "In Progress"]).default("Active"),
  insuranceProvider: z.string().max(200).optional(),
  insurancePolicyNumber: z.string().max(100).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;

export const updatePatientSchema = patientSchema.partial();

export const patientSearchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(["All", "Active", "Discharged", "Critical", "In Progress"]).default("All"),
  department: z.string().optional(),
});

export type PatientSearchData = z.infer<typeof patientSearchSchema>;

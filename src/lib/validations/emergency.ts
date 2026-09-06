import { z } from "zod";

export const emergencyCaseSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  doctorId: z.string().uuid("Invalid doctor ID").optional().nullable(),
  arrivalTime: z.string().min(1, "Arrival time is required"),
  triageLevel: z.number({ message: "Triage level must be a number" }).int().min(1).max(5),
  status: z.enum(["Waiting", "In Treatment", "Admitted", "Discharged", "Cancelled"], {
    message: "Status is required",
  }),
  chiefComplaint: z.string().min(1, "Chief complaint is required").max(500),
  diagnosis: z.string().optional().nullable(),
  treatment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type EmergencyCaseFormData = z.infer<typeof emergencyCaseSchema>;

export const emergencyCaseSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Waiting", "In Treatment", "Admitted", "Discharged", "Cancelled"]).default("All"),
  triageLevel: z.coerce.number({ message: "Triage level must be a number" }).int().min(1).max(5).optional(),
  patientId: z.string().optional(),
  doctorId: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type EmergencyCaseSearchData = z.infer<typeof emergencyCaseSearchSchema>;

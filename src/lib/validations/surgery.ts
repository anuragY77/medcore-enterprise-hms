import { z } from "zod";

export const surgerySchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  surgeonId: z.string().uuid("Invalid surgeon ID"),
  procedureName: z.string().min(1, "Procedure name is required").max(200),
  procedureType: z.enum(["Cardiac", "Orthopedic", "Neurological", "General", "Pediatric", "Oncology", "Plastic", "Transplant", "Emergency", "Other"], {
    message: "Procedure type is required",
  }),
  surgeryDate: z.string().min(1, "Surgery date is required"),
  estimatedDuration: z.number({ message: "Duration must be a number" }).int().min(1).optional().nullable(),
  operatingRoom: z.string().max(50).optional().nullable(),
  department: z.string().min(1, "Department is required").max(100),
  status: z.enum(["Scheduled", "In Progress", "Completed", "Cancelled", "Post-Op"], {
    message: "Status is required",
  }),
  preOpNotes: z.string().optional().nullable(),
  postOpNotes: z.string().optional().nullable(),
  complications: z.string().optional().nullable(),
  anesthesiaType: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type SurgeryFormData = z.infer<typeof surgerySchema>;

export const surgerySearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Scheduled", "In Progress", "Completed", "Cancelled", "Post-Op"]).default("All"),
  procedureType: z.string().optional(),
  surgeonId: z.string().optional(),
  patientId: z.string().optional(),
  department: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type SurgerySearchData = z.infer<typeof surgerySearchSchema>;

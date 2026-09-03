import { z } from "zod";

export const bedSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required").max(20),
  department: z.string().min(1, "Department is required").max(100),
  ward: z.string().max(100).optional(),
  type: z.enum(["General", "ICU", "Private", "Semi-Private"], {
    message: "Bed type is required",
  }),
  status: z.enum(["Available", "Occupied", "Maintenance", "Reserved"], {
    message: "Status is required",
  }),
  patientId: z.string().uuid("Invalid patient ID").optional().nullable(),
});

export type BedFormData = z.infer<typeof bedSchema>;

export const bedSearchSchema = z.object({
  query: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(["All", "Available", "Occupied", "Maintenance", "Reserved"]).default("All"),
  type: z.enum(["All", "General", "ICU", "Private", "Semi-Private"]).default("All"),
  roomNumber: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type BedSearchData = z.infer<typeof bedSearchSchema>;

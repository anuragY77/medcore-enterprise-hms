import { z } from "zod";
import { medicalRecordSchema } from "./clinical";

export const recordQuerySchema = z.object({
  search: z.string().max(200).optional(),
  recordType: z.enum(medicalRecordSchema.shape.recordType.options).optional(),
  patientId: z.string().uuid({ message: "Invalid patient ID" }).optional(),
  order: z.enum(["asc", "desc"], { message: "Invalid order" }).default("desc"),
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, "Page size must be at least 1")
    .max(100, "Page size must be at most 100")
    .default(20),
});

export type RecordQuery = z.infer<typeof recordQuerySchema>;

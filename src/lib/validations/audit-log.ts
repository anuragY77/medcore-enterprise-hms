import { z } from "zod";

export const auditLogQuerySchema = z.object({
  search: z.string().max(200).optional(),
  action: z.string().max(50).optional(),
  actorId: z.string().uuid({ message: "Invalid actor ID" }).optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().uuid({ message: "Invalid entity ID" }).optional(),
  severity: z.string().max(20).optional(),
  category: z.string().max(50).optional(),
  success: z.enum(["true", "false"], { message: "Invalid success value" }).optional(),
  from: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
    .optional(),
  to: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
    .optional(),
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, "Page size must be at least 1")
    .max(100, "Page size must be at most 100")
    .default(20),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

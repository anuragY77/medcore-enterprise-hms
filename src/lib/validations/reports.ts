import { z } from "zod";

export const reportQuerySchema = z
  .object({
    from: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
      .optional(),
    to: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && Date.parse(data.from) > Date.parse(data.to)) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be on or after from",
      });
    }
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;

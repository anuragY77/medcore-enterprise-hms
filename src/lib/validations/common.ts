import { z } from "zod";

export const paginationSchema = (defaultPageSize: number = 20) =>
  z.object({
    page: z.coerce
      .number({ message: "Page must be a number" })
      .int({ message: "Page must be an integer" })
      .min(1, "Page must be at least 1")
      // Phase 21: bounded so a crafted query cannot force unbounded offset
      // scans against the database.
      .max(100000, "Page must be at most 100000")
      .default(1),
    pageSize: z.coerce
      .number({ message: "Page size must be a number" })
      .int({ message: "Page size must be an integer" })
      .min(1, "Page size must be at least 1")
      // Phase 21: bounded so a crafted query cannot materialize an entire
      // table in one response. The largest UI request is pageSize=100.
      .max(100, "Page size must be at most 100")
      .default(defaultPageSize),
  });

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID"),
});

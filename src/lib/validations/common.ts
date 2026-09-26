import { z } from "zod";

export const paginationSchema = (defaultPageSize: number = 20) =>
  z.object({
    page: z.coerce
      .number({ message: "Page must be a number" })
      .int({ message: "Page must be an integer" })
      .min(1, "Page must be at least 1")
      .default(1),
    pageSize: z.coerce
      .number({ message: "Page size must be a number" })
      .int({ message: "Page size must be an integer" })
      .min(1, "Page size must be at least 1")
      .default(defaultPageSize),
  });

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID"),
});

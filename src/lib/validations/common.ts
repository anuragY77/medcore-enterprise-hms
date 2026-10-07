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

// Phase 22: user-supplied date strings must parse to a real date inside the
// range PostgreSQL can store. JavaScript happily parses strings such as
// "-100000-01-01" that PostgreSQL rejects (22009/22001/22003 class errors),
// which surfaced as a 500 from every route that does `new Date(value)` before
// insert. Years 1000-9999 sit well inside the database's timestamp range on
// both sides, so no plausible hospital record is affected.
export const isStorableDate = (value: string): boolean => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const year = parsed.getUTCFullYear();
  return year >= 1000 && year <= 9999;
};

export const dateFieldSchema = (requiredMessage = "Date is required") =>
  z
    .string()
    .min(1, requiredMessage)
    .refine(isStorableDate, { message: "Invalid date" });

// Optional date inputs keep their historical empty-string contract: routes
// treat "" as "not provided" (`value ? new Date(value) : null`), so "" must
// keep passing validation while garbage and out-of-range dates are rejected.
export const optionalDateFieldSchema = z
  .string()
  .refine((value) => value === "" || isStorableDate(value), {
    message: "Invalid date",
  })
  .optional();

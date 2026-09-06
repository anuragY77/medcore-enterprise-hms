import { z } from "zod";

export const pharmacyMedicineSchema = z.object({
  name: z.string().min(1, "Medicine name is required").max(200),
  genericName: z.string().max(200).optional(),
  category: z.string().min(1, "Category is required").max(100),
  manufacturer: z.string().max(200).optional(),
  description: z.string().optional(),
  dosage: z.string().max(100).optional(),
  unit: z.string().min(1, "Unit is required").max(50),
  stockQuantity: z
    .number({ message: "Stock quantity must be a number" })
    .int()
    .min(0, "Stock quantity must be non-negative"),
  reorderLevel: z
    .number({ message: "Reorder level must be a number" })
    .int()
    .min(0, "Reorder level must be non-negative")
    .optional()
    .nullable(),
  unitPrice: z
    .number({ message: "Unit price must be a number" })
    .min(0, "Unit price must be non-negative")
    .optional()
    .nullable(),
  expiryDate: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Discontinued"], {
    message: "Status is required",
  }),
});

export type PharmacyMedicineFormData = z.infer<typeof pharmacyMedicineSchema>;

export const pharmacyMedicineSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "Active", "Inactive", "Discontinued"]).default("All"),
  category: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type PharmacyMedicineSearchData = z.infer<typeof pharmacyMedicineSearchSchema>;

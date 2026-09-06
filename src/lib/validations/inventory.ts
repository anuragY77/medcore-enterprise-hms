import { z } from "zod";

export const inventoryItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200),
  category: z.string().min(1, "Category is required").max(100),
  description: z.string().optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  quantity: z
    .number({ message: "Quantity must be a number" })
    .int()
    .min(0, "Quantity must be non-negative"),
  reorderLevel: z
    .number({ message: "Reorder level must be a number" })
    .int()
    .min(0, "Reorder level must be non-negative")
    .optional()
    .nullable(),
  unit: z.string().min(1, "Unit is required").max(50),
  unitPrice: z
    .number({ message: "Unit price must be a number" })
    .min(0, "Unit price must be non-negative")
    .optional()
    .nullable(),
  location: z.string().max(200).optional().nullable(),
  status: z.enum(["In Stock", "Low Stock", "Out of Stock"], {
    message: "Status is required",
  }),
  lastRestockedAt: z.string().optional(),
});

export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>;

export const inventoryItemSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["All", "In Stock", "Low Stock", "Out of Stock"]).default("All"),
  category: z.string().optional(),
  supplier: z.string().optional(),
  location: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type InventoryItemSearchData = z.infer<typeof inventoryItemSearchSchema>;

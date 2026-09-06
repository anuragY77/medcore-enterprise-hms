"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inventoryItemSchema, type InventoryItemFormData } from "@/lib/validations/inventory";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const ITEM_CATEGORIES = [
  "Medical Supplies",
  "Surgical Instruments",
  "PPE",
  "Cleaning Supplies",
  "Office Supplies",
  "Laboratory Supplies",
  "Pharmacy Supplies",
  "IT Equipment",
  "Furniture",
  "Linens",
  "Nutrition",
  "Radiology Supplies",
];

const UNITS = [
  "Pieces",
  "Boxes",
  "Packs",
  "Rolls",
  "Bottles",
  "Bags",
  "Sets",
  "Pairs",
  "Liters",
  "Kg",
];

interface InventoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    name: string;
    category: string;
    description?: string | null;
    supplier?: string | null;
    quantity: number;
    reorderLevel?: number | null;
    unit: string;
    unitPrice?: number | null;
    location?: string | null;
    status: string;
    lastRestockedAt?: string | null;
  };
  mode?: "create" | "edit";
  onSuccess: () => void;
}

export function InventoryForm({ open, onOpenChange, initialData, mode = "create", onSuccess }: InventoryFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InventoryItemFormData>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          category: initialData.category,
          description: initialData.description ?? undefined,
          supplier: initialData.supplier ?? undefined,
          quantity: initialData.quantity,
          reorderLevel: initialData.reorderLevel ?? undefined,
          unit: initialData.unit,
          unitPrice: initialData.unitPrice ?? undefined,
          location: initialData.location ?? undefined,
          status: initialData.status as "In Stock" | "Low Stock" | "Out of Stock",
          lastRestockedAt: initialData.lastRestockedAt
            ? new Date(initialData.lastRestockedAt).toISOString().split("T")[0]
            : undefined,
        }
      : {
          status: "In Stock",
          quantity: 0,
        },
  });

  const onSubmit = async (data: InventoryItemFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const url = mode === "edit" && initialData
        ? `/api/inventory/${initialData.id}`
        : "/api/inventory";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save inventory item");
      }

      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setServerError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{mode === "edit" ? "Edit Inventory Item" : "Add New Inventory Item"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Update inventory item details." : "Add a new item to the inventory."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              {serverError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Item Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("name")}
              placeholder="e.g. Surgical Gloves"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                {...register("category")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select category</option>
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-destructive mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Unit <span className="text-destructive">*</span>
              </label>
              <select
                {...register("unit")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select unit</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              {errors.unit && (
                <p className="text-xs text-destructive mt-1">{errors.unit.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Supplier
            </label>
            <input
              {...register("supplier")}
              placeholder="e.g. MedSupply Co."
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Quantity <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                {...register("quantity", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.quantity && (
                <p className="text-xs text-destructive mt-1">{errors.quantity.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Reorder Level
              </label>
              <input
                type="number"
                {...register("reorderLevel", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Unit Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                {...register("unitPrice", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Location
              </label>
              <input
                {...register("location")}
                placeholder="e.g. Warehouse A, Shelf 3"
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Status <span className="text-destructive">*</span>
              </label>
              <select
                {...register("status")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
              {errors.status && (
                <p className="text-xs text-destructive mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Last Restocked
            </label>
            <input
              type="date"
              {...register("lastRestockedAt")}
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              {...register("description")}
              rows={2}
              placeholder="Item description or notes"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : mode === "edit" ? "Update Item" : "Add Item"}
            </button>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="px-4 py-2 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

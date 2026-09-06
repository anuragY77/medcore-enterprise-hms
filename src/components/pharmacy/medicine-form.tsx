"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pharmacyMedicineSchema, type PharmacyMedicineFormData } from "@/lib/validations/pharmacy";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const MEDICINE_CATEGORIES = [
  "Analgesics",
  "Antibiotics",
  "Antifungals",
  "Antihistamines",
  "Antihypertensives",
  "Antivirals",
  "Cardiovascular",
  "Dermatological",
  "Gastrointestinal",
  "Hormones",
  "Immunosuppressants",
  "Muscle Relaxants",
  "Neurological",
  "Ophthalmic",
  "Respiratory",
  "Vitamins & Supplements",
];

const UNITS = [
  "Tablets",
  "Capsules",
  "ml",
  "mg",
  "g",
  "L",
  "Bottles",
  "Vials",
  "Packs",
  "Boxes",
];

interface MedicineFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    name: string;
    genericName?: string | null;
    category: string;
    manufacturer?: string | null;
    description?: string | null;
    dosage?: string | null;
    unit: string;
    stockQuantity: number;
    reorderLevel?: number | null;
    unitPrice?: number | null;
    expiryDate?: string | null;
    status: string;
  };
  mode?: "create" | "edit";
  onSuccess: () => void;
}

export function MedicineForm({ open, onOpenChange, initialData, mode = "create", onSuccess }: MedicineFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PharmacyMedicineFormData>({
    resolver: zodResolver(pharmacyMedicineSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          genericName: initialData.genericName ?? undefined,
          category: initialData.category,
          manufacturer: initialData.manufacturer ?? undefined,
          description: initialData.description ?? undefined,
          dosage: initialData.dosage ?? undefined,
          unit: initialData.unit,
          stockQuantity: initialData.stockQuantity,
          reorderLevel: initialData.reorderLevel ?? undefined,
          unitPrice: initialData.unitPrice ?? undefined,
          expiryDate: initialData.expiryDate
            ? new Date(initialData.expiryDate).toISOString().split("T")[0]
            : undefined,
          status: initialData.status as "Active" | "Inactive" | "Discontinued",
        }
      : {
          status: "Active",
          stockQuantity: 0,
        },
  });

  const onSubmit = async (data: PharmacyMedicineFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const url = mode === "edit" && initialData
        ? `/api/pharmacy/${initialData.id}`
        : "/api/pharmacy";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save medicine");
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
          <SheetTitle>{mode === "edit" ? "Edit Medicine" : "Add New Medicine"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Update medicine details." : "Add a new medicine to the pharmacy inventory."}
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
              Medicine Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("name")}
              placeholder="e.g. Paracetamol"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Generic Name
            </label>
            <input
              {...register("genericName")}
              placeholder="e.g. Acetaminophen"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
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
                {MEDICINE_CATEGORIES.map((c) => (
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
              Manufacturer
            </label>
            <input
              {...register("manufacturer")}
              placeholder="e.g. PharmaCorp"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Dosage
              </label>
              <input
                {...register("dosage")}
                placeholder="e.g. 500mg"
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
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Discontinued">Discontinued</option>
              </select>
              {errors.status && (
                <p className="text-xs text-destructive mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Stock Qty <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                {...register("stockQuantity", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.stockQuantity && (
                <p className="text-xs text-destructive mt-1">{errors.stockQuantity.message}</p>
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Expiry Date
            </label>
            <input
              type="date"
              {...register("expiryDate")}
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
              placeholder="Medicine description or notes"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : mode === "edit" ? "Update Medicine" : "Add Medicine"}
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

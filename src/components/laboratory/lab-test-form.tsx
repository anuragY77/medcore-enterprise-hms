"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { labTestSchema, type LabTestFormData } from "@/lib/validations/laboratory";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const TEST_CATEGORIES = [
  "Blood Test",
  "Urine Test",
  "X-Ray",
  "MRI",
  "CT Scan",
  "Ultrasound",
  "ECG",
  "Biopsy",
  "Culture",
  "Hematology",
  "Biochemistry",
  "Microbiology",
  "Immunology",
  "Pathology",
  "Pulmonary Function",
  "Endoscopy",
];

interface LabTestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    patientId: string;
    consultationId?: string | null;
    testName: string;
    category: string;
    orderedBy?: string | null;
    status: string;
    result?: string | null;
    notes?: string | null;
    testDate: string;
    completedAt?: string | null;
  };
  mode?: "create" | "edit";
  onSuccess: () => void;
}

export function LabTestForm({ open, onOpenChange, initialData, mode = "create", onSuccess }: LabTestFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LabTestFormData>({
    resolver: zodResolver(labTestSchema),
    defaultValues: initialData
      ? {
          patientId: initialData.patientId,
          consultationId: initialData.consultationId ?? undefined,
          testName: initialData.testName,
          category: initialData.category,
          orderedBy: initialData.orderedBy ?? undefined,
          status: initialData.status as "Pending" | "In Progress" | "Completed",
          result: initialData.result ?? undefined,
          notes: initialData.notes ?? undefined,
          testDate: initialData.testDate
            ? new Date(initialData.testDate).toISOString().split("T")[0]
            : "",
          completedAt: initialData.completedAt
            ? new Date(initialData.completedAt).toISOString().split("T")[0]
            : undefined,
        }
      : {
          status: "Pending",
          testDate: new Date().toISOString().split("T")[0],
        },
  });

  const onSubmit = async (data: LabTestFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const url = mode === "edit" && initialData
        ? `/api/laboratory/${initialData.id}`
        : "/api/laboratory";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save lab test");
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
          <SheetTitle>{mode === "edit" ? "Edit Lab Test" : "Order New Lab Test"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Update laboratory test details." : "Order a new laboratory or diagnostic test."}
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
              Patient ID <span className="text-destructive">*</span>
            </label>
            <input
              {...register("patientId")}
              placeholder="Enter patient UUID"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
            {errors.patientId && (
              <p className="text-xs text-destructive mt-1">{errors.patientId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Consultation ID
            </label>
            <input
              {...register("consultationId")}
              placeholder="Enter consultation UUID (optional)"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
            {errors.consultationId && (
              <p className="text-xs text-destructive mt-1">{errors.consultationId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Test Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("testName")}
              placeholder="e.g. Complete Blood Count"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.testName && (
              <p className="text-xs text-destructive mt-1">{errors.testName.message}</p>
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
                {TEST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-destructive mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Status <span className="text-destructive">*</span>
              </label>
              <select
                {...register("status")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              {errors.status && (
                <p className="text-xs text-destructive mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Ordered By
            </label>
            <input
              {...register("orderedBy")}
              placeholder="e.g. Dr. Smith"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Test Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                {...register("testDate")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.testDate && (
                <p className="text-xs text-destructive mt-1">{errors.testDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Completed At
              </label>
              <input
                type="date"
                {...register("completedAt")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Result
            </label>
            <textarea
              {...register("result")}
              rows={3}
              placeholder="Enter test results (leave blank if pending)"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Notes
            </label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Additional notes or instructions"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : mode === "edit" ? "Update Test" : "Order Test"}
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

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insuranceClaimSchema, type InsuranceClaimFormData } from "@/lib/validations/insurance";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface ClaimFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    patientId: string;
    invoiceId?: string | null;
    providerName: string;
    policyNumber: string;
    claimAmount: number;
    approvedAmount?: number | null;
    status: string;
    diagnosis?: string | null;
    treatmentCode?: string | null;
    submittedDate?: string | null;
    processedDate?: string | null;
    denialReason?: string | null;
    notes?: string | null;
  };
  mode?: "create" | "edit";
  onSuccess: () => void;
}

export function ClaimForm({ open, onOpenChange, initialData, mode = "create", onSuccess }: ClaimFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InsuranceClaimFormData>({
    resolver: zodResolver(insuranceClaimSchema),
    defaultValues: initialData
      ? {
          patientId: initialData.patientId,
          invoiceId: initialData.invoiceId ?? undefined,
          providerName: initialData.providerName,
          policyNumber: initialData.policyNumber,
          claimAmount: initialData.claimAmount,
          approvedAmount: initialData.approvedAmount ?? undefined,
          status: initialData.status as "Submitted" | "Processing" | "Approved" | "Denied",
          diagnosis: initialData.diagnosis ?? undefined,
          treatmentCode: initialData.treatmentCode ?? undefined,
          submittedDate: initialData.submittedDate
            ? new Date(initialData.submittedDate).toISOString().split("T")[0]
            : undefined,
          processedDate: initialData.processedDate
            ? new Date(initialData.processedDate).toISOString().split("T")[0]
            : undefined,
          denialReason: initialData.denialReason ?? undefined,
          notes: initialData.notes ?? undefined,
        }
      : {
          status: "Submitted",
          submittedDate: new Date().toISOString().split("T")[0],
          claimAmount: 0,
        },
  });

  const onSubmit = async (data: InsuranceClaimFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const url = mode === "edit" && initialData
        ? `/api/insurance/${initialData.id}`
        : "/api/insurance";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save claim");
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
          <SheetTitle>{mode === "edit" ? "Edit Claim" : "Submit New Claim"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Update insurance claim details." : "Submit a new insurance claim."}
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
            <label className="block text-sm font-medium text-foreground mb-1">Invoice ID</label>
            <input
              {...register("invoiceId")}
              placeholder="Enter invoice UUID (optional)"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
            {errors.invoiceId && (
              <p className="text-xs text-destructive mt-1">{errors.invoiceId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Provider Name <span className="text-destructive">*</span>
              </label>
              <input
                {...register("providerName")}
                placeholder="e.g. Blue Cross"
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.providerName && (
                <p className="text-xs text-destructive mt-1">{errors.providerName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Policy Number <span className="text-destructive">*</span>
              </label>
              <input
                {...register("policyNumber")}
                placeholder="e.g. BC-12345"
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.policyNumber && (
                <p className="text-xs text-destructive mt-1">{errors.policyNumber.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Claim Amount <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register("claimAmount", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.claimAmount && (
                <p className="text-xs text-destructive mt-1">{errors.claimAmount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Approved Amount</label>
              <input
                type="number"
                step="0.01"
                {...register("approvedAmount", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.approvedAmount && (
                <p className="text-xs text-destructive mt-1">{errors.approvedAmount.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Status <span className="text-destructive">*</span>
            </label>
            <select
              {...register("status")}
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="Submitted">Submitted</option>
              <option value="Processing">Processing</option>
              <option value="Approved">Approved</option>
              <option value="Denied">Denied</option>
            </select>
            {errors.status && (
              <p className="text-xs text-destructive mt-1">{errors.status.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Submitted Date</label>
              <input
                type="date"
                {...register("submittedDate")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Processed Date</label>
              <input
                type="date"
                {...register("processedDate")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Diagnosis</label>
            <input
              {...register("diagnosis")}
              placeholder="e.g. ICD-10 code or description"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Treatment Code</label>
            <input
              {...register("treatmentCode")}
              placeholder="e.g. CPT code"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Denial Reason</label>
            <input
              {...register("denialReason")}
              placeholder="Reason if denied (optional)"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Additional notes"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : mode === "edit" ? "Update Claim" : "Submit Claim"}
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

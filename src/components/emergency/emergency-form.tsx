"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { emergencyCaseSchema, type EmergencyCaseFormData } from "@/lib/validations/emergency";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface EmergencyCaseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    patientId: string;
    doctorId?: string | null;
    arrivalTime: string;
    triageLevel: number;
    status: string;
    chiefComplaint: string;
    diagnosis?: string | null;
    treatment?: string | null;
    notes?: string | null;
  };
  mode?: "create" | "edit";
  onSuccess: () => void;
}

export function EmergencyCaseForm({ open, onOpenChange, initialData, mode = "create", onSuccess }: EmergencyCaseFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmergencyCaseFormData>({
    resolver: zodResolver(emergencyCaseSchema),
    defaultValues: initialData
      ? {
          patientId: initialData.patientId,
          doctorId: initialData.doctorId ?? undefined,
          arrivalTime: initialData.arrivalTime
            ? new Date(initialData.arrivalTime).toISOString().slice(0, 16)
            : "",
          triageLevel: initialData.triageLevel,
          status: initialData.status as EmergencyCaseFormData["status"],
          chiefComplaint: initialData.chiefComplaint,
          diagnosis: initialData.diagnosis ?? undefined,
          treatment: initialData.treatment ?? undefined,
          notes: initialData.notes ?? undefined,
        }
      : {
          status: "Waiting",
          triageLevel: 3,
          arrivalTime: new Date().toISOString().slice(0, 16),
        },
  });

  const onSubmit = async (data: EmergencyCaseFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const url = mode === "edit" && initialData
        ? `/api/emergency/${initialData.id}`
        : "/api/emergency";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save emergency case");
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
          <SheetTitle>{mode === "edit" ? "Edit Emergency Case" : "New Emergency Case"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Update emergency case details." : "Register a new emergency department case."}
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
              Doctor ID
            </label>
            <input
              {...register("doctorId")}
              placeholder="Enter doctor staff UUID (optional)"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
            {errors.doctorId && (
              <p className="text-xs text-destructive mt-1">{errors.doctorId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Arrival Time <span className="text-destructive">*</span>
              </label>
              <input
                type="datetime-local"
                {...register("arrivalTime")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.arrivalTime && (
                <p className="text-xs text-destructive mt-1">{errors.arrivalTime.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Triage Level <span className="text-destructive">*</span>
              </label>
              <select
                {...register("triageLevel", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value={1}>1 — Resuscitation</option>
                <option value={2}>2 — Emergent</option>
                <option value={3}>3 — Urgent</option>
                <option value={4}>4 — Less Urgent</option>
                <option value={5}>5 — Non-Urgent</option>
              </select>
              {errors.triageLevel && (
                <p className="text-xs text-destructive mt-1">{errors.triageLevel.message}</p>
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
              <option value="Waiting">Waiting</option>
              <option value="In Treatment">In Treatment</option>
              <option value="Admitted">Admitted</option>
              <option value="Discharged">Discharged</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            {errors.status && (
              <p className="text-xs text-destructive mt-1">{errors.status.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Chief Complaint <span className="text-destructive">*</span>
            </label>
            <textarea
              {...register("chiefComplaint")}
              rows={2}
              placeholder="Describe the chief complaint"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.chiefComplaint && (
              <p className="text-xs text-destructive mt-1">{errors.chiefComplaint.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Diagnosis
            </label>
            <textarea
              {...register("diagnosis")}
              rows={2}
              placeholder="Enter diagnosis (if available)"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Treatment
            </label>
            <textarea
              {...register("treatment")}
              rows={2}
              placeholder="Treatment provided or planned"
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
              {isSubmitting ? "Saving..." : mode === "edit" ? "Update Case" : "Create Case"}
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

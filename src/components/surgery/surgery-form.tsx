"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { surgerySchema, type SurgeryFormData } from "@/lib/validations/surgery";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const PROCEDURE_TYPES = [
  "Cardiac",
  "Orthopedic",
  "Neurological",
  "General",
  "Pediatric",
  "Oncology",
  "Plastic",
  "Transplant",
  "Emergency",
  "Other",
];

const ANESTHESIA_TYPES = [
  "General",
  "Regional",
  "Local",
  "Sedation",
  "Spinal",
  "Epidural",
  "None",
];

interface SurgeryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    patientId: string;
    surgeonId: string;
    procedureName: string;
    procedureType: string;
    surgeryDate: string;
    estimatedDuration?: number | null;
    operatingRoom?: string | null;
    department: string;
    status: string;
    preOpNotes?: string | null;
    postOpNotes?: string | null;
    complications?: string | null;
    anesthesiaType?: string | null;
    notes?: string | null;
  };
  mode?: "create" | "edit";
  onSuccess: () => void;
}

export function SurgeryForm({ open, onOpenChange, initialData, mode = "create", onSuccess }: SurgeryFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SurgeryFormData>({
    resolver: zodResolver(surgerySchema),
    defaultValues: initialData
      ? {
          patientId: initialData.patientId,
          surgeonId: initialData.surgeonId,
          procedureName: initialData.procedureName,
          procedureType: initialData.procedureType as SurgeryFormData["procedureType"],
          surgeryDate: initialData.surgeryDate
            ? new Date(initialData.surgeryDate).toISOString().split("T")[0]
            : "",
          estimatedDuration: initialData.estimatedDuration ?? undefined,
          operatingRoom: initialData.operatingRoom ?? undefined,
          department: initialData.department,
          status: initialData.status as SurgeryFormData["status"],
          preOpNotes: initialData.preOpNotes ?? undefined,
          postOpNotes: initialData.postOpNotes ?? undefined,
          complications: initialData.complications ?? undefined,
          anesthesiaType: initialData.anesthesiaType ?? undefined,
          notes: initialData.notes ?? undefined,
        }
      : {
          status: "Scheduled",
          surgeryDate: new Date().toISOString().split("T")[0],
        },
  });

  const onSubmit = async (data: SurgeryFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const url = mode === "edit" && initialData
        ? `/api/surgeries/${initialData.id}`
        : "/api/surgeries";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save surgery");
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
          <SheetTitle>{mode === "edit" ? "Edit Surgery" : "Schedule New Surgery"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Update surgery details." : "Schedule a new surgical procedure."}
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
              Surgeon ID <span className="text-destructive">*</span>
            </label>
            <input
              {...register("surgeonId")}
              placeholder="Enter surgeon staff UUID"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
            {errors.surgeonId && (
              <p className="text-xs text-destructive mt-1">{errors.surgeonId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Procedure Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("procedureName")}
              placeholder="e.g. Coronary Artery Bypass Graft"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.procedureName && (
              <p className="text-xs text-destructive mt-1">{errors.procedureName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Procedure Type <span className="text-destructive">*</span>
              </label>
              <select
                {...register("procedureType")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select type</option>
                {PROCEDURE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {errors.procedureType && (
                <p className="text-xs text-destructive mt-1">{errors.procedureType.message}</p>
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
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Post-Op">Post-Op</option>
              </select>
              {errors.status && (
                <p className="text-xs text-destructive mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Surgery Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                {...register("surgeryDate")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.surgeryDate && (
                <p className="text-xs text-destructive mt-1">{errors.surgeryDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Est. Duration (min)
              </label>
              <input
                type="number"
                {...register("estimatedDuration", { valueAsNumber: true })}
                placeholder="e.g. 120"
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.estimatedDuration && (
                <p className="text-xs text-destructive mt-1">{errors.estimatedDuration.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Operating Room
              </label>
              <input
                {...register("operatingRoom")}
                placeholder="e.g. OR-1"
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Department <span className="text-destructive">*</span>
              </label>
              <input
                {...register("department")}
                placeholder="e.g. Cardiology"
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.department && (
                <p className="text-xs text-destructive mt-1">{errors.department.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Anesthesia Type
            </label>
            <select
              {...register("anesthesiaType")}
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select anesthesia</option>
              {ANESTHESIA_TYPES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Pre-Op Notes
            </label>
            <textarea
              {...register("preOpNotes")}
              rows={2}
              placeholder="Pre-operative notes and instructions"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Post-Op Notes
            </label>
            <textarea
              {...register("postOpNotes")}
              rows={2}
              placeholder="Post-operative notes and recovery instructions"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Complications
            </label>
            <textarea
              {...register("complications")}
              rows={2}
              placeholder="Any surgical complications"
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
              {isSubmitting ? "Saving..." : mode === "edit" ? "Update Surgery" : "Schedule Surgery"}
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

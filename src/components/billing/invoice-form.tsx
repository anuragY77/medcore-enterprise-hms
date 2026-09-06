"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations/billing";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const PAYMENT_METHODS = ["Cash", "Credit Card", "Debit Card", "Insurance", "Bank Transfer", "Check", "Online"];

interface InvoiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    patientId: string;
    appointmentId?: string | null;
    description?: string | null;
    subtotal: number;
    taxAmount?: number | null;
    discountAmount?: number | null;
    totalAmount: number;
    paidAmount?: number | null;
    status: string;
    paymentMethod?: string | null;
    paidDate?: string | null;
    dueDate?: string | null;
    notes?: string | null;
  };
  mode?: "create" | "edit";
  onSuccess: () => void;
}

export function InvoiceForm({ open, onOpenChange, initialData, mode = "create", onSuccess }: InvoiceFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initialData
      ? {
          patientId: initialData.patientId,
          appointmentId: initialData.appointmentId ?? undefined,
          description: initialData.description ?? undefined,
          subtotal: initialData.subtotal,
          taxAmount: initialData.taxAmount ?? undefined,
          discountAmount: initialData.discountAmount ?? undefined,
          totalAmount: initialData.totalAmount,
          paidAmount: initialData.paidAmount ?? undefined,
          status: initialData.status as "Pending" | "Paid" | "Overdue" | "Cancelled",
          paymentMethod: initialData.paymentMethod ?? undefined,
          paidDate: initialData.paidDate
            ? new Date(initialData.paidDate).toISOString().split("T")[0]
            : undefined,
          dueDate: initialData.dueDate
            ? new Date(initialData.dueDate).toISOString().split("T")[0]
            : undefined,
          notes: initialData.notes ?? undefined,
        }
      : {
          status: "Pending",
          subtotal: 0,
          totalAmount: 0,
        },
  });

  const onSubmit = async (data: InvoiceFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const url = mode === "edit" && initialData
        ? `/api/billing/${initialData.id}`
        : "/api/billing";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save invoice");
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
          <SheetTitle>{mode === "edit" ? "Edit Invoice" : "Create New Invoice"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Update invoice details." : "Create a new invoice for billing."}
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
            <label className="block text-sm font-medium text-foreground mb-1">Appointment ID</label>
            <input
              {...register("appointmentId")}
              placeholder="Enter appointment UUID (optional)"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
            {errors.appointmentId && (
              <p className="text-xs text-destructive mt-1">{errors.appointmentId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <input
              {...register("description")}
              placeholder="e.g. Consultation fee, Lab tests"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Subtotal <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register("subtotal", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.subtotal && (
                <p className="text-xs text-destructive mt-1">{errors.subtotal.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Total Amount <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register("totalAmount", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.totalAmount && (
                <p className="text-xs text-destructive mt-1">{errors.totalAmount.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tax Amount</label>
              <input
                type="number"
                step="0.01"
                {...register("taxAmount", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.taxAmount && (
                <p className="text-xs text-destructive mt-1">{errors.taxAmount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Discount Amount</label>
              <input
                type="number"
                step="0.01"
                {...register("discountAmount", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.discountAmount && (
                <p className="text-xs text-destructive mt-1">{errors.discountAmount.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Paid Amount</label>
              <input
                type="number"
                step="0.01"
                {...register("paidAmount", { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.paidAmount && (
                <p className="text-xs text-destructive mt-1">{errors.paidAmount.message}</p>
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
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              {errors.status && (
                <p className="text-xs text-destructive mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Payment Method</label>
            <select
              {...register("paymentMethod")}
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select method</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
              <input
                type="date"
                {...register("dueDate")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Paid Date</label>
              <input
                type="date"
                {...register("paidDate")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
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
              {isSubmitting ? "Saving..." : mode === "edit" ? "Update Invoice" : "Create Invoice"}
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

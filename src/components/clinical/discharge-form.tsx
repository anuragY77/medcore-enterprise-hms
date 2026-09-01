"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dischargeSchema, type DischargeFormData } from "@/lib/validations/clinical";

interface DischargeFormProps {
  patientId: string;
  onSuccess: () => void;
}

export function DischargeForm({ patientId, onSuccess }: DischargeFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DischargeFormData>({
    resolver: zodResolver(dischargeSchema),
  });

  async function onSubmit(data: DischargeFormData) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to discharge patient");
      }
      reset();
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Discharge Patient</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="diagnosis">Discharge Diagnosis *</Label>
            <Textarea id="diagnosis" {...register("diagnosis")} placeholder="Final diagnosis..." rows={2} />
            {errors.diagnosis && (
              <p className="text-xs text-red-500">{errors.diagnosis.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatmentSummary">Treatment Summary *</Label>
            <Textarea id="treatmentSummary" {...register("treatmentSummary")} placeholder="Summary of treatment provided..." rows={3} />
            {errors.treatmentSummary && (
              <p className="text-xs text-red-500">{errors.treatmentSummary.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="followUpInstructions">Follow-up Instructions</Label>
            <Textarea id="followUpInstructions" {...register("followUpInstructions")} placeholder="Follow-up care instructions..." rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medicationsOnDischarge">Medications on Discharge</Label>
            <Textarea id="medicationsOnDischarge" {...register("medicationsOnDischarge")} placeholder="List of medications..." rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up Date</Label>
            <Input id="followUpDate" type="date" {...register("followUpDate")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Additional notes..." rows={2} />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Discharge Patient
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

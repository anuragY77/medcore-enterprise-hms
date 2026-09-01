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
import {
  prescriptionSchema,
  type PrescriptionFormData,
} from "@/lib/validations/clinical";

interface PrescriptionFormProps {
  patientId: string;
  onSuccess: () => void;
}

export function PrescriptionForm({ patientId, onSuccess }: PrescriptionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionSchema),
  });

  async function onSubmit(data: PrescriptionFormData) {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...data,
        consultationId: data.consultationId || undefined,
      };
      const res = await fetch(`/api/patients/${patientId}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save prescription");
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
        <CardTitle className="text-base">New Prescription</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="medicationName">Medication *</Label>
              <Input id="medicationName" {...register("medicationName")} placeholder="Amoxicillin" />
              {errors.medicationName && (
                <p className="text-xs text-red-500">{errors.medicationName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage *</Label>
              <Input id="dosage" {...register("dosage")} placeholder="500mg" />
              {errors.dosage && (
                <p className="text-xs text-red-500">{errors.dosage.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Input id="frequency" {...register("frequency")} placeholder="TID" />
              {errors.frequency && (
                <p className="text-xs text-red-500">{errors.frequency.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input id="duration" {...register("duration")} placeholder="7 days" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prescribedBy">Prescribing Doctor *</Label>
            <Input id="prescribedBy" {...register("prescribedBy")} placeholder="Dr. Smith" />
            {errors.prescribedBy && (
              <p className="text-xs text-red-500">{errors.prescribedBy.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea id="instructions" {...register("instructions")} placeholder="Take with food..." rows={2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Prescription
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

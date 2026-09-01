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
  consultationSchema,
  type ConsultationFormData,
} from "@/lib/validations/clinical";

interface ConsultationFormProps {
  patientId: string;
  onSuccess: () => void;
}

export function ConsultationForm({ patientId, onSuccess }: ConsultationFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
  });

  async function onSubmit(data: ConsultationFormData) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save consultation");
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
        <CardTitle className="text-base">New Consultation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doctorName">Doctor Name *</Label>
              <Input id="doctorName" {...register("doctorName")} placeholder="Dr. Smith" />
              {errors.doctorName && (
                <p className="text-xs text-red-500">{errors.doctorName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="chiefComplaint">Chief Complaint *</Label>
              <Input id="chiefComplaint" {...register("chiefComplaint")} placeholder="Chest pain, shortness of breath" />
              {errors.chiefComplaint && (
                <p className="text-xs text-red-500">{errors.chiefComplaint.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis *</Label>
            <Input id="diagnosis" {...register("diagnosis")} placeholder="Acute bronchitis" />
            {errors.diagnosis && (
              <p className="text-xs text-red-500">{errors.diagnosis.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatmentPlan">Treatment Plan</Label>
            <Textarea id="treatmentPlan" {...register("treatmentPlan")} placeholder="Prescribed antibiotics and rest" rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Additional notes..." rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up Date</Label>
            <Input id="followUpDate" type="date" {...register("followUpDate")} />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Consultation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { vitalSchema, type VitalFormData } from "@/lib/validations/clinical";

interface VitalsFormProps {
  patientId: string;
  onSuccess: () => void;
}

export function VitalsForm({ patientId, onSuccess }: VitalsFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VitalFormData>({
    resolver: zodResolver(vitalSchema),
  });

  async function onSubmit(data: VitalFormData) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save vitals");
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
        <CardTitle className="text-base">Record Vitals</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bloodPressureSystolic">BP Systolic (mmHg)</Label>
              <Input
                id="bloodPressureSystolic"
                type="number"
                {...register("bloodPressureSystolic", { valueAsNumber: true })}
                placeholder="120"
              />
              {errors.bloodPressureSystolic && (
                <p className="text-xs text-red-500">{errors.bloodPressureSystolic.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bloodPressureDiastolic">BP Diastolic (mmHg)</Label>
              <Input
                id="bloodPressureDiastolic"
                type="number"
                {...register("bloodPressureDiastolic", { valueAsNumber: true })}
                placeholder="80"
              />
              {errors.bloodPressureDiastolic && (
                <p className="text-xs text-red-500">{errors.bloodPressureDiastolic.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
              <Input
                id="heartRate"
                type="number"
                {...register("heartRate", { valueAsNumber: true })}
                placeholder="72"
              />
              {errors.heartRate && (
                <p className="text-xs text-red-500">{errors.heartRate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature (°C)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                {...register("temperature", { valueAsNumber: true })}
                placeholder="36.5"
              />
              {errors.temperature && (
                <p className="text-xs text-red-500">{errors.temperature.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="respiratoryRate">Respiratory Rate (/min)</Label>
              <Input
                id="respiratoryRate"
                type="number"
                {...register("respiratoryRate", { valueAsNumber: true })}
                placeholder="16"
              />
              {errors.respiratoryRate && (
                <p className="text-xs text-red-500">{errors.respiratoryRate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="oxygenSaturation">SpO2 (%)</Label>
              <Input
                id="oxygenSaturation"
                type="number"
                {...register("oxygenSaturation", { valueAsNumber: true })}
                placeholder="98"
              />
              {errors.oxygenSaturation && (
                <p className="text-xs text-red-500">{errors.oxygenSaturation.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                {...register("weight", { valueAsNumber: true })}
                placeholder="70"
              />
              {errors.weight && (
                <p className="text-xs text-red-500">{errors.weight.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                {...register("height", { valueAsNumber: true })}
                placeholder="175"
              />
              {errors.height && (
                <p className="text-xs text-red-500">{errors.height.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recordedBy">Recorded By *</Label>
            <Input id="recordedBy" {...register("recordedBy")} placeholder="Nurse Johnson" />
            {errors.recordedBy && (
              <p className="text-xs text-red-500">{errors.recordedBy.message}</p>
            )}
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Vitals
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

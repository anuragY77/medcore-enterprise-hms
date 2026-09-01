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
import { admissionSchema, type AdmissionFormData } from "@/lib/validations/clinical";

interface AdmissionFormProps {
  patientId: string;
  onSuccess: () => void;
}

export function AdmissionForm({ patientId, onSuccess }: AdmissionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdmissionFormData>({
    resolver: zodResolver(admissionSchema),
  });

  async function onSubmit(data: AdmissionFormData) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/admission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to admit patient");
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
        <CardTitle className="text-base">Admit Patient</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Input id="department" {...register("department")} placeholder="Cardiology" />
              {errors.department && (
                <p className="text-xs text-red-500">{errors.department.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendingDoctor">Attending Doctor *</Label>
              <Input id="attendingDoctor" {...register("attendingDoctor")} placeholder="Dr. Smith" />
              {errors.attendingDoctor && (
                <p className="text-xs text-red-500">{errors.attendingDoctor.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Admission Reason *</Label>
            <Textarea id="reason" {...register("reason")} placeholder="Chest pain, shortness of breath..." rows={3} />
            {errors.reason && (
              <p className="text-xs text-red-500">{errors.reason.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Additional notes..." rows={2} />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Admit Patient
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

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
  medicalRecordSchema,
  type MedicalRecordFormData,
} from "@/lib/validations/clinical";

interface MedicalRecordFormProps {
  patientId: string;
  onSuccess: () => void;
}

export function MedicalRecordForm({ patientId, onSuccess }: MedicalRecordFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MedicalRecordFormData>({
    resolver: zodResolver(medicalRecordSchema),
  });

  async function onSubmit(data: MedicalRecordFormData) {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...data,
        fileUrl: data.fileUrl || undefined,
      };
      const res = await fetch(`/api/patients/${patientId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save record");
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
        <CardTitle className="text-base">New Medical Record</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recordType">Record Type *</Label>
              <select
                id="recordType"
                {...register("recordType")}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select type...</option>
                <option value="Clinical">Clinical</option>
                <option value="Lab">Lab</option>
                <option value="Imaging">Imaging</option>
                <option value="Administrative">Administrative</option>
                <option value="Discharge">Discharge</option>
              </select>
              {errors.recordType && (
                <p className="text-xs text-red-500">{errors.recordType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordedBy">Recorded By *</Label>
              <Input id="recordedBy" {...register("recordedBy")} placeholder="Dr. Smith" />
              {errors.recordedBy && (
                <p className="text-xs text-red-500">{errors.recordedBy.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register("title")} placeholder="Lab Results - Blood Panel" />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} placeholder="Detailed description..." rows={3} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fileUrl">File URL</Label>
              <Input id="fileUrl" {...register("fileUrl")} placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordDate">Record Date</Label>
              <Input id="recordDate" type="date" {...register("recordDate")} />
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Record
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

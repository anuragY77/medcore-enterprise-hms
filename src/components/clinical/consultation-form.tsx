"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  onSuccess: (createdId?: string) => void;
  appointmentId?: string;
  appointmentContext?: { appointmentCode: string; doctorName: string };
}

export function ConsultationForm({
  patientId,
  onSuccess,
  appointmentId,
  appointmentContext,
}: ConsultationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    reset,
    formState: { errors },
  } = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
    defaultValues:
      appointmentId && appointmentContext
        ? { doctorName: appointmentContext.doctorName }
        : undefined,
  });

  async function onSubmit(data: ConsultationFormData) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setConflict(false);
    try {
      const endpoint = appointmentId
        ? `/api/appointments/${appointmentId}/consultation`
        : `/api/patients/${patientId}/consultations`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!appointmentId) {
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to save consultation");
        }
        reset();
        onSuccess();
        return;
      }

      if (res.status === 401) {
        router.push(`/login?callbackUrl=/appointments/${appointmentId}`);
        return;
      }
      if (res.status === 403) {
        setError("You do not have permission to start this consultation.");
        return;
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => null);
        const details = body?.details as
          | Record<string, string[] | undefined>
          | undefined;
        let mapped = false;
        if (details && typeof details === "object") {
          for (const [field, messages] of Object.entries(details)) {
            if (
              Array.isArray(messages) &&
              messages.length > 0 &&
              field in data
            ) {
              setFieldError(field as keyof ConsultationFormData, {
                message: messages[0],
              });
              mapped = true;
            }
          }
        }
        if (!mapped) {
          setError((body?.error as string | undefined) || "Validation failed");
        }
        return;
      }
      if (res.status === 404) {
        setError("Appointment not found.");
        return;
      }
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        setConflict(true);
        setError(
          (body?.error as string | undefined) ||
            "This appointment cannot start a consultation."
        );
        return;
      }
      if (res.status >= 500) {
        setError("Failed to start consultation. Please try again.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          (body?.error as string | undefined) ||
            "Failed to start consultation. Please try again."
        );
        return;
      }

      const created = await res.json().catch(() => null);
      onSuccess(created?.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {appointmentId ? "Start Consultation" : "New Consultation"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
              {conflict && (
                <>
                  {" "}
                  <Link
                    href={`/patients/${patientId}/consultation`}
                    className="font-medium underline"
                  >
                    View consultations
                  </Link>
                </>
              )}
            </div>
          )}

          {appointmentId && appointmentContext && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              Appointment{" "}
              <span className="font-medium">
                {appointmentContext.appointmentCode}
              </span>
              {" \u00b7 "}
              {appointmentContext.doctorName}
            </div>
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
            {errors.treatmentPlan && (
              <p className="text-xs text-red-500">{errors.treatmentPlan.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Additional notes..." rows={2} />
            {errors.notes && (
              <p className="text-xs text-red-500">{errors.notes.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up Date</Label>
            <Input id="followUpDate" type="date" {...register("followUpDate")} />
            {errors.followUpDate && (
              <p className="text-xs text-red-500">{errors.followUpDate.message}</p>
            )}
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {appointmentId
              ? loading
                ? "Starting..."
                : "Start Consultation"
              : "Save Consultation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

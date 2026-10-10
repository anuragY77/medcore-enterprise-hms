"use client";

import { cloneElement, isValidElement, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, ArrowLeft, RefreshCw, Save } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { patientSchema, type PatientFormData } from "@/lib/validations/patient";
import { cn } from "@/lib/utils";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function FormField({
  label,
  error,
  children,
  required,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground mb-1.5"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ id?: string }>, { id })
        : children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

const inputClasses =
  "w-full px-3 py-2 text-sm bg-card border border-border/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground";

export default function NewPatientPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [referenceError, setReferenceError] = useState(false);
  const [referenceRetry, setReferenceRetry] = useState(0);

  // Phase 28: dropdown options come from the authoritative reference endpoint
  // instead of a hard-coded list that offered departments absent from this
  // hospital. Same async load() pattern as the list pages (no setState in
  // the effect body itself).
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setReferenceLoading(true);
      setReferenceError(false);
      try {
        const res = await fetch("/api/reference");
        if (res.status === 401) {
          router.push("/login?callbackUrl=/patients/new");
          return;
        }
        if (!res.ok) {
          throw new Error("reference load failed");
        }
        const data = (await res.json()) as {
          departments?: string[];
          doctors?: string[];
        };
        if (cancelled) return;
        setDepartments(Array.isArray(data.departments) ? data.departments : []);
        setDoctors(Array.isArray(data.doctors) ? data.doctors : []);
      } catch {
        if (!cancelled) {
          setReferenceError(true);
        }
      } finally {
        if (!cancelled) {
          setReferenceLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router, referenceRetry]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema) as Resolver<PatientFormData>,
    defaultValues: {
      status: "Active",
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.status === 401) {
        router.push("/login?callbackUrl=/patients/new");
        return;
      }
      if (res.status === 403) {
        setServerError("You do not have permission to register patients.");
        return;
      }
      if (res.status === 400) {
        const err = await res.json().catch(() => null);
        const details = err?.details as
          | Record<string, string[] | undefined>
          | undefined;
        let mappedField = false;
        if (details && typeof details === "object") {
          for (const [field, messages] of Object.entries(details)) {
            if (messages && messages.length > 0 && field in data) {
              setError(field as keyof PatientFormData, { message: messages[0] });
              mappedField = true;
            }
          }
        }
        if (!mappedField) {
          setServerError(
            (err?.error as string | undefined) || "Failed to register patient"
          );
        }
        return;
      }
      if (!res.ok) {
        setServerError("Failed to register patient. Please try again.");
        return;
      }

      const created = await res.json().catch(() => null);
      if (created?.id) {
        router.push(`/patients/${created.id}`);
      } else {
        router.push("/patients");
      }
      router.refresh();
    } catch {
      setServerError("Failed to register patient. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: "New Registration" },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline flex items-center gap-2">
            <UserPlus className="h-7 w-7 text-primary" />
            New Patient Registration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register a new patient in the system
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {referenceError && (
          <div
            role="alert"
            className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-md text-sm flex items-center justify-between gap-3"
          >
            <span>
              Failed to load departments and doctors. Registration is disabled
              until the reference data loads.
            </span>
            <button
              type="button"
              onClick={() => setReferenceRetry((n) => n + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md transition-colors shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}
        {serverError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm"
          >
            {serverError}
          </div>
        )}
        <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="First Name" error={errors.firstName?.message} required>
              <input
                {...register("firstName")}
                className={cn(inputClasses, errors.firstName && "border-destructive")}
                placeholder="Enter first name"
              />
            </FormField>

            <FormField label="Last Name" error={errors.lastName?.message} required>
              <input
                {...register("lastName")}
                className={cn(inputClasses, errors.lastName && "border-destructive")}
                placeholder="Enter last name"
              />
            </FormField>

            <FormField label="Date of Birth" error={errors.dateOfBirth?.message} required>
              <input
                {...register("dateOfBirth")}
                type="date"
                className={cn(inputClasses, errors.dateOfBirth && "border-destructive")}
              />
            </FormField>

            <FormField label="Gender" error={errors.gender?.message} required>
              <select
                {...register("gender")}
                className={cn(inputClasses, errors.gender && "border-destructive")}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </FormField>

            <FormField label="Blood Group" error={errors.bloodGroup?.message}>
              <select
                {...register("bloodGroup")}
                className={cn(inputClasses, errors.bloodGroup && "border-destructive")}
              >
                <option value="">Select blood group</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Phone" error={errors.phone?.message} required>
              <input
                {...register("phone")}
                className={cn(inputClasses, errors.phone && "border-destructive")}
                placeholder="+1-555-0000"
              />
            </FormField>

            <FormField label="Email" error={errors.email?.message}>
              <input
                {...register("email")}
                type="email"
                className={cn(inputClasses, errors.email && "border-destructive")}
                placeholder="patient@email.com"
              />
            </FormField>

            <FormField label="Address" error={errors.address?.message} className="sm:col-span-2">
              <textarea
                {...register("address")}
                rows={2}
                className={cn(inputClasses, errors.address && "border-destructive")}
                placeholder="Enter full address"
              />
            </FormField>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
            Medical Assignment
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Department" error={errors.department?.message} required>
              <select
                {...register("department")}
                disabled={referenceLoading}
                className={cn(inputClasses, errors.department && "border-destructive")}
              >
                <option value="">
                  {referenceLoading ? "Loading departments..." : "Select department"}
                </option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Attending Doctor" error={errors.attendingDoctor?.message} required>
              <select
                {...register("attendingDoctor")}
                disabled={referenceLoading}
                className={cn(inputClasses, errors.attendingDoctor && "border-destructive")}
              >
                <option value="">
                  {referenceLoading ? "Loading doctors..." : "Select doctor"}
                </option>
                {doctors.map((doc) => (
                  <option key={doc} value={doc}>
                    {doc}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status" error={errors.status?.message}>
              <select
                {...register("status")}
                className={cn(inputClasses, errors.status && "border-destructive")}
              >
                <option value="Active">Active</option>
                <option value="In Progress">In Progress</option>
                <option value="Critical">Critical</option>
                <option value="Discharged">Discharged</option>
              </select>
            </FormField>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
            Insurance Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Insurance Provider" error={errors.insuranceProvider?.message}>
              <input
                {...register("insuranceProvider")}
                className={cn(inputClasses, errors.insuranceProvider && "border-destructive")}
                placeholder="Insurance provider name"
              />
            </FormField>

            <FormField label="Policy Number" error={errors.insurancePolicyNumber?.message}>
              <input
                {...register("insurancePolicyNumber")}
                className={cn(inputClasses, errors.insurancePolicyNumber && "border-destructive")}
                placeholder="Policy number"
              />
            </FormField>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
            Emergency Contact
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Contact Name" error={errors.emergencyContactName?.message}>
              <input
                {...register("emergencyContactName")}
                className={cn(inputClasses, errors.emergencyContactName && "border-destructive")}
                placeholder="Emergency contact name"
              />
            </FormField>

            <FormField label="Contact Phone" error={errors.emergencyContactPhone?.message}>
              <input
                {...register("emergencyContactPhone")}
                className={cn(inputClasses, errors.emergencyContactPhone && "border-destructive")}
                placeholder="+1-555-0000"
              />
            </FormField>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || referenceLoading || referenceError}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Registering..." : "Register Patient"}
          </button>
        </div>
      </form>
    </div>
  );
}

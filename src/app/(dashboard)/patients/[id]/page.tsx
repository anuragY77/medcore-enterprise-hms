"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Shield,
  Heart,
  AlertTriangle,
  Pill,
  Calendar,
  FileText,
  ClipboardList,
} from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { cn } from "@/lib/utils";
import { mockPatients } from "@/components/patients/patient-data";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Discharged: "bg-slate-100 text-slate-800",
  Critical: "bg-red-100 text-red-800",
  "In Progress": "bg-amber-100 text-amber-800",
};

const MOCK_ALLERGIES = [
  { allergy: "Penicillin", severity: "Severe" },
  { allergy: "Sulfa drugs", severity: "Moderate" },
  { allergy: "Peanuts", severity: "Mild" },
];

const MOCK_CONDITIONS = [
  { condition: "Hypertension", status: "Active", diagnosedDate: "2020-06-15" },
  { condition: "Type 2 Diabetes", status: "Active", diagnosedDate: "2019-03-22" },
];

const MOCK_MEDICATIONS = [
  { medication: "Lisinopril", dosage: "10mg", frequency: "Once daily", prescribedBy: "Dr. Michael Chen" },
  { medication: "Metformin", dosage: "500mg", frequency: "Twice daily", prescribedBy: "Dr. Michael Chen" },
];

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

export default function PatientRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const patient = mockPatients.find((p) => p.id === id);

  if (!patient) {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Patients", href: "/patients" },
            { label: "Not Found" },
          ]}
        />
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm flex flex-col items-center justify-center text-center mt-6">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Patient Not Found
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            The patient with ID &quot;{id}&quot; could not be found.
          </p>
          <Link
            href="/patients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Patients
          </Link>
        </div>
      </div>
    );
  }

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const dob = new Date(patient.dateOfBirth);
  const now = new Date();
  const age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: fullName },
       ]}
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/patients"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-foreground font-headline">
              {fullName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {patient.patientId} &middot; {age} years old &middot; {patient.gender}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
            STATUS_COLORS[patient.status] ?? "bg-slate-100 text-slate-800"
          )}
        >
          {patient.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground font-headline mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={Phone} label="Phone" value={patient.phone} />
              <InfoRow icon={Mail} label="Email" value={patient.email} />
              <InfoRow icon={MapPin} label="Address" value={patient.address} />
              <InfoRow icon={Heart} label="Blood Group" value={patient.bloodGroup} />
              <InfoRow icon={Shield} label="Department" value={patient.department} />
              <InfoRow icon={User} label="Attending Doctor" value={patient.attendingDoctor} />
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground font-headline mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Allergies
            </h2>
            {MOCK_ALLERGIES.length === 0 ? (
              <p className="text-sm text-muted-foreground">No allergies recorded.</p>
            ) : (
              <div className="space-y-2">
                {MOCK_ALLERGIES.map((allergy, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <span className="text-sm font-medium text-foreground">{allergy.allergy}</span>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        allergy.severity === "Severe"
                          ? "bg-red-100 text-red-800"
                          : allergy.severity === "Moderate"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-800"
                      )}
                    >
                      {allergy.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground font-headline mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Active Conditions
            </h2>
            {MOCK_CONDITIONS.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conditions recorded.</p>
            ) : (
              <div className="space-y-2">
                {MOCK_CONDITIONS.map((condition, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">{condition.condition}</span>
                      {condition.diagnosedDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Diagnosed: {new Date(condition.diagnosedDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {condition.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground font-headline mb-4 flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              Current Medications
            </h2>
            {MOCK_MEDICATIONS.length === 0 ? (
              <p className="text-sm text-muted-foreground">No medications recorded.</p>
            ) : (
              <div className="space-y-2">
                {MOCK_MEDICATIONS.map((med, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">{med.medication}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {med.dosage} &middot; {med.frequency}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{med.prescribedBy}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground font-headline mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Insurance
            </h2>
            <div className="space-y-3">
              <InfoRow icon={Shield} label="Provider" value={patient.insuranceProvider} />
              <InfoRow icon={FileText} label="Policy #" value={patient.insurancePolicyNumber} />
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground font-headline mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Emergency Contact
            </h2>
            <div className="space-y-3">
              <InfoRow icon={User} label="Name" value={patient.emergencyContactName} />
              <InfoRow icon={Phone} label="Phone" value={patient.emergencyContactPhone} />
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground font-headline mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Record Details
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                <span className="text-foreground font-medium">
                  {new Date(patient.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Last Updated:</span>{" "}
                <span className="text-foreground font-medium">
                  {new Date(patient.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                href={`/patients/${patient.id}/consultation`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <FileText className="h-4 w-4 text-primary" />
                New Consultation
              </Link>
              <Link
                href={`/patients/${patient.id}/prescriptions`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Pill className="h-4 w-4 text-primary" />
                Prescriptions
              </Link>
              <Link
                href={`/patients/${patient.id}/records`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ClipboardList className="h-4 w-4 text-primary" />
                Medical Records
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

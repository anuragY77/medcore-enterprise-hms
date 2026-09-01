import Link from "next/link";
import { User, Phone, Mail, MapPin, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";

interface PatientCardProps {
  patient: Patient;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Discharged: "bg-slate-100 text-slate-800",
  Critical: "bg-red-100 text-red-800",
  "In Progress": "bg-amber-100 text-amber-800",
};

export function PatientCard({ patient, compact = false }: PatientCardProps) {
  const fullName = `${patient.firstName} ${patient.lastName}`;

  if (compact) {
    return (
      <Link
        href={`/patients/${patient.id}`}
        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
      >
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground">{patient.patientId}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
            STATUS_COLORS[patient.status] ?? "bg-slate-100 text-slate-800"
          )}
        >
          {patient.status}
        </span>
      </Link>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border/50 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-foreground font-headline truncate">
              {fullName}
            </h3>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                STATUS_COLORS[patient.status] ?? "bg-slate-100 text-slate-800"
              )}
            >
              {patient.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{patient.patientId}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{patient.phone}</span>
            </div>
            {patient.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{patient.email}</span>
              </div>
            )}
            {patient.address && (
              <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{patient.address}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{patient.department}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

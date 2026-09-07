"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface WardPatient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  gender: string;
  department: string;
  attendingDoctor: string;
  status: string;
  bedId: string;
  roomNumber: string;
  ward: string | null;
  bedType: string;
  bedStatus: string;
  latestVitals: {
    bloodPressureSystolic: number | null;
    bloodPressureDiastolic: number | null;
    heartRate: number | null;
    temperature: number | null;
    oxygenSaturation: number | null;
    recordedAt: string;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Admitted: "bg-blue-100 text-blue-800",
  Discharged: "bg-slate-100 text-slate-800",
  Critical: "bg-red-100 text-red-800",
  Stable: "bg-emerald-100 text-emerald-800",
  Observation: "bg-amber-100 text-amber-800",
};

function formatVitalSummary(patient: WardPatient): string {
  const v = patient.latestVitals;
  if (!v) return "No vitals recorded";
  const parts: string[] = [];
  if (v.bloodPressureSystolic && v.bloodPressureDiastolic) {
    parts.push(`${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`);
  }
  if (v.heartRate) parts.push(`HR ${v.heartRate}`);
  if (v.temperature) parts.push(`${v.temperature}°C`);
  if (v.oxygenSaturation) parts.push(`SpO2 ${v.oxygenSaturation}%`);
  return parts.length > 0 ? parts.join(" · ") : "No vitals recorded";
}

interface WardPatientTableProps {
  patients: WardPatient[];
  loading?: boolean;
}

export function WardPatientTable({ patients, loading }: WardPatientTableProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center text-muted-foreground text-sm">
        Loading ward patients...
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">Ward Patient List</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Room</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Condition</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No patients currently assigned to wards.
                </td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{patient.patientId}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-foreground">{patient.roomNumber}</p>
                      {patient.ward && (
                        <p className="text-xs text-muted-foreground">{patient.ward}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px]">
                    {formatVitalSummary(patient)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[patient.status] ?? "bg-slate-100 text-slate-800"
                      )}
                    >
                      {patient.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/patients/${patient.id}`}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors inline-flex"
                      title="View patient record"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

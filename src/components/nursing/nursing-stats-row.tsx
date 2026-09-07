"use client";

import { Users, ListTodo, Pill, AlertTriangle } from "lucide-react";

interface NursingStatsRowProps {
  patientsAssigned: number;
  pendingTasks: number;
  medsDue: number;
  alerts: number;
}

const stats = [
  {
    key: "patientsAssigned" as const,
    label: "Patients Assigned",
    icon: Users,
    bgClass: "bg-primary/10",
    iconClass: "text-primary",
  },
  {
    key: "pendingTasks" as const,
    label: "Pending Tasks",
    icon: ListTodo,
    bgClass: "bg-amber-100",
    iconClass: "text-amber-600",
  },
  {
    key: "medsDue" as const,
    label: "Meds Due",
    icon: Pill,
    bgClass: "bg-blue-100",
    iconClass: "text-blue-600",
  },
  {
    key: "alerts" as const,
    label: "Alerts",
    icon: AlertTriangle,
    bgClass: "bg-red-100",
    iconClass: "text-red-600",
  },
];

export function NursingStatsRow({ patientsAssigned, pendingTasks, medsDue, alerts }: NursingStatsRowProps) {
  const values = { patientsAssigned, pendingTasks, medsDue, alerts };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.key} className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${stat.bgClass} flex items-center justify-center`}>
              <stat.icon className={`h-5 w-5 ${stat.iconClass}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{values[stat.key]}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

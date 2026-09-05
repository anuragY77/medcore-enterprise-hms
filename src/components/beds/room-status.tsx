"use client";

import { BedDouble, AlertTriangle, CheckCircle2, Wrench, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bed } from "./bed-grid";

interface RoomStatusProps {
  beds: Bed[];
}

export function RoomStatus({ beds }: RoomStatusProps) {
  const total = beds.length;
  const available = beds.filter((b) => b.status === "Available").length;
  const occupied = beds.filter((b) => b.status === "Occupied").length;
  const maintenance = beds.filter((b) => b.status === "Maintenance").length;
  const reserved = beds.filter((b) => b.status === "Reserved").length;

  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const stats = [
    { label: "Total Beds", value: total, icon: BedDouble, color: "text-slate-600", bg: "bg-slate-100" },
    { label: "Available", value: available, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Occupied", value: occupied, icon: AlertTriangle, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Maintenance", value: maintenance, icon: Wrench, color: "text-amber-600", bg: "bg-amber-100" },
    { label: "Reserved", value: reserved, icon: Clock, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  return (
    <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Room Overview</h3>
        <span className="text-xs text-muted-foreground">
          Occupancy: <span className="font-medium text-foreground">{occupancyRate}%</span>
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-4">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${occupancyRate}%` }}
        />
      </div>
      <div className="grid grid-cols-5 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className={cn("h-8 w-8 rounded-full mx-auto mb-1 flex items-center justify-center", stat.bg)}>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </div>
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

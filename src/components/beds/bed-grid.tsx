"use client";

import { BedDouble, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Bed {
  id: string;
  bedId: string;
  roomNumber: string;
  department: string;
  ward: string | null;
  type: string;
  status: string;
  patientId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BedGridProps {
  beds: Bed[];
}

const STATUS_COLORS: Record<string, string> = {
  Available: "bg-emerald-100 text-emerald-800",
  Occupied: "bg-blue-100 text-blue-800",
  Maintenance: "bg-amber-100 text-amber-800",
  Reserved: "bg-purple-100 text-purple-800",
};

const TYPE_ICONS: Record<string, string> = {
  ICU: "text-red-600",
  General: "text-slate-600",
  Private: "text-violet-600",
  "Semi-Private": "text-blue-600",
};

export function BedGrid({ beds }: BedGridProps) {
  if (beds.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center text-muted-foreground">
        No beds found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {beds.map((bed) => (
        <div
          key={bed.id}
          className={cn(
            "bg-card rounded-lg border border-border/50 p-4 shadow-sm transition-colors hover:bg-muted/20",
            bed.status === "Occupied" && "border-l-4 border-l-blue-400",
            bed.status === "Available" && "border-l-4 border-l-emerald-400",
            bed.status === "Maintenance" && "border-l-4 border-l-amber-400",
            bed.status === "Reserved" && "border-l-4 border-l-purple-400"
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <BedDouble className={cn("h-4 w-4", TYPE_ICONS[bed.type] ?? "text-slate-600")} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{bed.bedId}</p>
                <p className="text-xs text-muted-foreground">Room {bed.roomNumber}</p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                STATUS_COLORS[bed.status] ?? "bg-slate-100 text-slate-800"
              )}
            >
              {bed.status}
            </span>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Type: <span className="font-medium text-foreground">{bed.type}</span></p>
            <p>Dept: <span className="font-medium text-foreground">{bed.department}</span></p>
            {bed.ward && <p>Ward: <span className="font-medium text-foreground">{bed.ward}</span></p>}
          </div>

          {bed.patientId && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">Patient assigned</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

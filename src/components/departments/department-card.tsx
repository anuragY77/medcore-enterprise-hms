"use client";

import { Building2, Phone, MapPin, User, BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";

interface DepartmentCardProps {
  departmentId: string;
  name: string;
  description?: string | null;
  headDoctor?: string | null;
  phone?: string | null;
  location?: string | null;
  totalBeds?: number | null;
  status: string;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Inactive: "bg-slate-100 text-slate-800",
};

export function DepartmentCard({
  departmentId,
  name,
  description,
  headDoctor,
  phone,
  location,
  totalBeds,
  status,
  compact = false,
}: DepartmentCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{departmentId}</p>
        </div>
        <span
          className={cn(
            "ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
            STATUS_COLORS[status] ?? "bg-slate-100 text-slate-800"
          )}
        >
          {status}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-foreground font-headline truncate">
              {name}
            </h3>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                STATUS_COLORS[status] ?? "bg-slate-100 text-slate-800"
              )}
            >
              {status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{departmentId}</p>

          {description && (
            <p className="text-sm text-muted-foreground mb-3">{description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {headDoctor && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{headDoctor}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{phone}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
            {totalBeds != null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <BedDouble className="h-3.5 w-3.5 shrink-0" />
                <span>{totalBeds} beds</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  color?: string;
}

export function ReportCard({
  label,
  value,
  hint,
  icon: Icon,
  color = "text-primary",
}: ReportCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("h-4 w-4", color)} aria-hidden="true" />
      </div>
      <p className="text-2xl font-semibold text-foreground font-headline">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

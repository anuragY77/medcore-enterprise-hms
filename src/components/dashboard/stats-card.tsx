import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  color?: string;
}

export function StatsCard({
  label,
  value,
  change,
  icon: Icon,
  color = "text-primary",
}: StatsCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <p className="text-2xl font-semibold text-foreground font-headline">
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{change}</p>
    </div>
  );
}

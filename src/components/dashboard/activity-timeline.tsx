"use client";

import { ScrollText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardActivityEvent } from "@/types/dashboard";

const TYPE_CONFIG: Record<
  DashboardActivityEvent["type"],
  { icon: typeof ScrollText; color: string }
> = {
  audit: { icon: ScrollText, color: "text-primary" },
  alert: { icon: AlertTriangle, color: "text-destructive" },
};

function relativeTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface ActivityTimelineProps {
  events: DashboardActivityEvent[];
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
        Recent Activity
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.audit;
            const Icon = config.icon;
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0"
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full mt-1.5 shrink-0",
                    event.type === "alert" ? "bg-destructive" : "bg-primary",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{event.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Icon className={cn("h-3 w-3", config.color)} />
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

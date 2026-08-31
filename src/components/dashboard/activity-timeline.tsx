import {
  UserPlus,
  UserMinus,
  Stethoscope,
  FlaskConical,
  PillBottle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_DATA } from "./dashboard-data";
import type { ActivityEvent } from "./dashboard-data";

const TYPE_CONFIG: Record<
  ActivityEvent["type"],
  { icon: typeof UserPlus; color: string }
> = {
  admission: { icon: UserPlus, color: "text-primary" },
  discharge: { icon: UserMinus, color: "text-muted-foreground" },
  consultation: { icon: Stethoscope, color: "text-primary" },
  lab: { icon: FlaskConical, color: "text-status-progress-foreground" },
  pharmacy: { icon: PillBottle, color: "text-success" },
  alert: { icon: AlertTriangle, color: "text-destructive" },
};

export function ActivityTimeline() {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
        Recent Activity
      </h2>
      <div className="space-y-3">
        {ACTIVITY_DATA.map((event) => {
          const config = TYPE_CONFIG[event.type];
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
                    {event.timestamp}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

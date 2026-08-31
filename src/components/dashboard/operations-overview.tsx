import { cn } from "@/lib/utils";
import { OPERATIONS_DATA } from "./dashboard-data";

export function OperationsOverview() {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
        Operations Overview
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {OPERATIONS_DATA.map((metric) => (
          <div
            key={metric.label}
            className="p-3 rounded-lg bg-muted/50 border border-border/30"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              {metric.label}
            </p>
            <p className={cn("text-2xl font-semibold font-headline", metric.color)}>
              {metric.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metric.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { DashboardDepartment } from "@/types/dashboard";

const STATUS_STYLES = {
  available: {
    badge: "bg-status-available text-status-available-foreground",
    label: "Available",
  },
  warning: {
    badge: "bg-status-warning-bg text-status-warning-foreground",
    label: "High Occupancy",
  },
  critical: {
    badge: "bg-status-critical text-status-critical-foreground",
    label: "Full",
  },
} as const;

interface DepartmentStatusProps {
  departments: DashboardDepartment[];
}

export function DepartmentStatus({ departments }: DepartmentStatusProps) {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
        Department Status
      </h2>
      {departments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No department bed data available.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const statusStyle = STATUS_STYLES[dept.status];
            return (
              <div
                key={dept.name}
                className="p-4 rounded-lg border border-border/50 bg-card"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {dept.name}
                  </h3>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      statusStyle.badge,
                    )}
                  >
                    {statusStyle.label}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Beds</span>
                    <span className="font-medium text-foreground">
                      {dept.bedsOccupied}/{dept.bedsTotal}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={cn(
                        "h-1.5 rounded-full",
                        dept.status === "critical"
                          ? "bg-destructive"
                          : dept.status === "warning"
                            ? "bg-warning"
                            : "bg-success",
                      )}
                      style={{
                        width: `${(dept.bedsOccupied / dept.bedsTotal) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Staff</span>
                    <span className="font-medium text-foreground">
                      {dept.activeStaff}
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

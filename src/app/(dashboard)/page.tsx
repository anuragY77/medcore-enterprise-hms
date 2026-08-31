import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatsCard } from "@/components/dashboard/stats-card";
import { OperationsOverview } from "@/components/dashboard/operations-overview";
import { DepartmentStatus } from "@/components/dashboard/department-status";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PatientAdmissionsChart } from "@/components/dashboard/patient-admissions-chart";
import { DepartmentUtilizationChart } from "@/components/dashboard/department-utilization-chart";
import { STATS_DATA } from "@/components/dashboard/dashboard-data";

export default function DashboardPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Hospital Operations Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time overview of hospital operations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STATS_DATA.map((stat) => (
          <StatsCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <OperationsOverview />
        <PatientAdmissionsChart />
      </div>

      <div className="mb-6">
        <DepartmentStatus />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DepartmentUtilizationChart />
        <div className="space-y-4">
          <ActivityTimeline />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

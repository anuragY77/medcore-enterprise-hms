"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, BedDouble, CalendarDays, Activity, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatsCard } from "@/components/dashboard/stats-card";
import { OperationsOverview } from "@/components/dashboard/operations-overview";
import { DepartmentStatus } from "@/components/dashboard/department-status";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PatientAdmissionsChart } from "@/components/dashboard/patient-admissions-chart";
import { DepartmentUtilizationChart } from "@/components/dashboard/department-utilization-chart";
import { BillingSummary } from "@/components/dashboard/billing-summary";
import type {
  DashboardStats,
  DashboardStatsResponse,
  OperationMetric,
} from "@/types/dashboard";

function formatCount(value: number): string {
  return value.toLocaleString();
}

interface DashboardPageState {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardPageState>({
    stats: null,
    loading: true,
    error: null,
  });

  const fetchStats = useCallback(async (): Promise<DashboardStats | null> => {
    const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
    if (res.status === 401) {
      return null;
    }
    if (!res.ok) {
      throw new Error("Request failed");
    }
    const body = (await res.json()) as DashboardStatsResponse;
    if (!body?.data) {
      throw new Error("Malformed response");
    }
    return body.data;
  }, []);

  const handleData = useCallback(
    (data: DashboardStats | null) => {
      if (data) {
        setState({ stats: data, loading: false, error: null });
      } else {
        router.push("/login?callbackUrl=/");
      }
    },
    [router]
  );

  const handleError = useCallback(() => {
    setState({
      stats: null,
      loading: false,
      error: "Unable to load dashboard statistics.",
    });
  }, []);

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchStats().then(handleData, handleError);
  }, [fetchStats, handleData, handleError]);

  useEffect(() => {
    fetchStats().then(handleData, handleError);
  }, [fetchStats, handleData, handleError]);

  const stats = state.stats;

  const operationMetrics: OperationMetric[] = stats
    ? [
        {
          label: "Admissions Today",
          value: formatCount(stats.operations.admissionsToday),
          description: "Patient admission records created today",
          color: "text-primary",
        },
        {
          label: "Discharges Today",
          value: formatCount(stats.operations.dischargesToday),
          description: "Discharge records created today",
          color: "text-status-available-foreground",
        },
        {
          label: "Pending Cases",
          value: formatCount(stats.operations.pendingCases),
          description: "Scheduled or confirmed appointments awaiting completion",
          color: "text-status-warning-foreground",
        },
        {
          label: "ER Visits Today",
          value: formatCount(stats.operations.erVisitsToday),
          description: "Emergency cases that arrived today",
          color: "text-destructive",
        },
      ]
    : [];

  const utilizationData = (stats?.departments ?? []).map((dept) => ({
    department: dept.name,
    utilization: dept.occupancyPercentage,
  }));

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
        <button
          type="button"
          onClick={refresh}
          disabled={state.loading}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium text-foreground border border-border/50 hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div aria-live="polite">
        {state.loading && !stats && (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            Loading dashboard statistics...
          </div>
        )}

        {state.error && (
          <div className="flex flex-col items-center gap-3 py-20">
            <p className="text-sm text-destructive">{state.error}</p>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-primary border border-border/50 hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatsCard
                label="Total Patients"
                value={formatCount(stats.patients.total)}
                change={`${formatCount(stats.patients.newThisMonth)} new this month`}
                icon={Users}
                color="text-primary"
              />
              <StatsCard
                label="Occupied Beds"
                value={formatCount(stats.beds.occupied)}
                change={`${stats.beds.occupancyPercentage}% occupancy of ${formatCount(stats.beds.total)} beds`}
                icon={BedDouble}
                color="text-status-warning-foreground"
              />
              <StatsCard
                label="Today's Appointments"
                value={formatCount(stats.appointments.today)}
                change={`${formatCount(stats.appointments.pendingToday)} pending today`}
                icon={CalendarDays}
                color="text-status-available-foreground"
              />
              <StatsCard
                label="Active Cases"
                value={formatCount(stats.patients.active)}
                change={`${formatCount(stats.patients.critical)} critical`}
                icon={Activity}
                color="text-destructive"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <OperationsOverview metrics={operationMetrics} />
              <PatientAdmissionsChart data={stats.admissionsChart} />
            </div>

            <div className="mb-6">
              <DepartmentStatus departments={stats.departments} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DepartmentUtilizationChart data={utilizationData} />
              <div className="space-y-4">
                <ActivityTimeline events={stats.activity} />
                <BillingSummary financial={stats.financial} />
                <QuickActions />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

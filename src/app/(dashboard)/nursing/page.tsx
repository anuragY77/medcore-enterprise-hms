"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  NursingStatsRow,
  WardPatientTable,
  TaskQueue,
  ShiftSummary,
  QuickActions,
  type WardPatient,
  type TaskItem,
} from "@/components/nursing";

interface DashboardStats {
  patientsAssigned: number;
  pendingTasks: number;
  medsDue: number;
  alerts: number;
  admissionsToday: number;
  dischargesToday: number;
}

interface Filters {
  searchQuery: string;
  wardFilter: string;
  statusFilter: string;
}

function buildParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.searchQuery) params.set("search", filters.searchQuery);
  if (filters.wardFilter) params.set("ward", filters.wardFilter);
  if (filters.statusFilter !== "All") params.set("status", filters.statusFilter);
  return params;
}

function buildTasks(patientList: WardPatient[]): TaskItem[] {
  const items: TaskItem[] = [];
  let id = 1;
  for (const p of patientList) {
    if (p.status === "Active" || p.status === "Critical" || p.status === "In Progress") {
      items.push({
        id: String(id++),
        type: "medication",
        label: `Medication round — ${p.roomNumber}`,
        patientRoom: `${p.firstName} ${p.lastName} · Room ${p.roomNumber}`,
        dueTime: "Ongoing",
        status: "pending",
      });
    }
  }
  if (items.length === 0) {
    items.push({ id: "1", type: "other", label: "No pending tasks", status: "completed" });
  }
  return items;
}

export default function NursingPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<WardPatient[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    patientsAssigned: 0,
    pendingTasks: 0,
    medsDue: 0,
    alerts: 0,
    admissionsToday: 0,
    dischargesToday: 0,
  });
  const [shiftData, setShiftData] = useState({ admissions: 0, discharges: 0, occupied: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [wardFilter, setWardFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const applyResults = useCallback((patientList: WardPatient[], statsData: DashboardStats) => {
    setPatients(patientList);
    setStats(statsData);
    setTasks(buildTasks(patientList));
    setShiftData({
      admissions: Number(statsData.admissionsToday ?? 0),
      discharges: Number(statsData.dischargesToday ?? 0),
      occupied: patientList.filter((p) => p.bedStatus === "Occupied").length,
    });
  }, []);

  const loadDashboard = useCallback(
    async (filters: Filters) => {
      try {
        setLoading(true);
        setError(null);
        const params = buildParams(filters);
        params.set("pageSize", "100");
        const [patientsRes, statsRes] = await Promise.all([
          fetch(`/api/nursing/ward-patients?${params.toString()}`),
          fetch("/api/nursing/dashboard-stats"),
        ]);
        if (patientsRes.status === 401 || statsRes.status === 401) {
          router.push("/login?callbackUrl=/nursing");
          return;
        }
        if (!patientsRes.ok || !statsRes.ok) {
          throw new Error(
            patientsRes.status === 403 || statsRes.status === 403
              ? "You do not have permission to view the nurse station."
              : "Failed to load dashboard"
          );
        }
        const patientsData = await patientsRes.json();
        const statsData = await statsRes.json();
        applyResults(patientsData.data || [], statsData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    },
    [applyResults, router]
  );

  useEffect(() => {
    const controller = new AbortController();
    async function init() {
      try {
        setLoading(true);
        setError(null);
        const [patientsRes, statsRes] = await Promise.all([
          fetch("/api/nursing/ward-patients?pageSize=100", { signal: controller.signal }),
          fetch("/api/nursing/dashboard-stats", { signal: controller.signal }),
        ]);
        if (patientsRes.status === 403 || statsRes.status === 403) {
          throw new Error("You do not have permission to view the nurse station.");
        }
        if (!patientsRes.ok || !statsRes.ok) throw new Error("Failed to load dashboard");
        const patientsData = await patientsRes.json();
        const statsData = await statsRes.json();
        applyResults(patientsData.data || [], statsData.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    init();
    return () => controller.abort();
  }, [applyResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadDashboard({ searchQuery, wardFilter, statusFilter });
  };

  const handleRefresh = () => {
    loadDashboard({ searchQuery, wardFilter, statusFilter });
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Nursing" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Nurse Station Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ward management and patient care operations
          </p>
        </div>
        <button
          aria-label="Refresh list"
          onClick={handleRefresh}
          className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <NursingStatsRow
        patientsAssigned={stats.patientsAssigned}
        pendingTasks={stats.pendingTasks}
        medsDue={stats.medsDue}
        alerts={stats.alerts}
      />

      <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search patients by name, ID, or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="text"
            placeholder="Filter by ward..."
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="w-40 px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Critical">Critical</option>
            <option value="In Progress">In Progress</option>
            <option value="Discharged">Discharged</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WardPatientTable patients={patients} loading={loading} />
        </div>
        <div className="space-y-6">
          <TaskQueue tasks={tasks} loading={loading} />
          <ShiftSummary
            admissions={shiftData.admissions}
            discharges={shiftData.discharges}
            occupied={shiftData.occupied}
            loading={loading}
          />
          <QuickActions patients={patients} />
        </div>
      </div>
    </div>
  );
}

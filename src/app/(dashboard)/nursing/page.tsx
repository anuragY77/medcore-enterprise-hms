"use client";

import { useState, useEffect, useCallback } from "react";
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
    if (p.status === "Admitted" || p.status === "Active") {
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
  const [patients, setPatients] = useState<WardPatient[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    patientsAssigned: 0,
    pendingTasks: 0,
    medsDue: 0,
    alerts: 0,
  });
  const [shiftData, setShiftData] = useState({ admissions: 0, discharges: 0, transfers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [wardFilter, setWardFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadDashboard = useCallback(async (filters: Filters) => {
    try {
      setLoading(true);
      setError(null);
      const params = buildParams(filters);
      const [patientsRes, statsRes] = await Promise.all([
        fetch(`/api/nursing/ward-patients?${params.toString()}`),
        fetch("/api/nursing/dashboard-stats"),
      ]);
      if (!patientsRes.ok) throw new Error("Failed to fetch ward patients");
      if (!statsRes.ok) throw new Error("Failed to fetch dashboard stats");
      const patientsData = await patientsRes.json();
      const statsData = await statsRes.json();
      const patientList: WardPatient[] = patientsData.data || [];
      setPatients(patientList);
      setStats(statsData.data);
      setTasks(buildTasks(patientList));
      setShiftData({ admissions: patientList.length, discharges: 0, transfers: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function init() {
      try {
        setLoading(true);
        setError(null);
        const [patientsRes, statsRes] = await Promise.all([
          fetch("/api/nursing/ward-patients", { signal: controller.signal }),
          fetch("/api/nursing/dashboard-stats", { signal: controller.signal }),
        ]);
        if (!patientsRes.ok) throw new Error("Failed to fetch ward patients");
        if (!statsRes.ok) throw new Error("Failed to fetch dashboard stats");
        const patientsData = await patientsRes.json();
        const statsData = await statsRes.json();
        const patientList: WardPatient[] = patientsData.data || [];
        setPatients(patientList);
        setStats(statsData.data);
        setTasks(buildTasks(patientList));
        setShiftData({ admissions: patientList.length, discharges: 0, transfers: 0 });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    init();
    return () => controller.abort();
  }, []);

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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Admitted">Admitted</option>
            <option value="Observation">Observation</option>
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
            transfers={shiftData.transfers}
            loading={loading}
          />
          <QuickActions patients={patients} />
        </div>
      </div>
    </div>
  );
}

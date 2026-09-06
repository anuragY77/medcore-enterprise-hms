"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Siren, Clock, Stethoscope, CheckCircle2, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { EmergencyCaseTable, EmergencyCaseForm, type EmergencyCase } from "@/components/emergency";

const TRIAGE_LEVELS = [1, 2, 3, 4, 5];

export default function EmergencyPage() {
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [triageFilter, setTriageFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<EmergencyCase | undefined>(undefined);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (triageFilter) params.set("triageLevel", triageFilter);

      const res = await fetch(`/api/emergency?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch emergency cases");
      const data = await res.json();
      setCases(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emergency cases");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, triageFilter]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/emergency");
        if (!res.ok) throw new Error("Failed to fetch emergency cases");
        const data = await res.json();
        setCases(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load emergency cases");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCases();
  };

  const handleEdit = (emergencyCase: EmergencyCase) => {
    setEditingCase(emergencyCase);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingCase(undefined);
    fetchCases();
  };

  const totalCases = cases.length;
  const waitingCases = cases.filter((c) => c.status === "Waiting").length;
  const inTreatmentCases = cases.filter((c) => c.status === "In Treatment").length;
  const admittedCases = cases.filter((c) => c.status === "Admitted").length;

  return (
    <div>
      <Breadcrumb items={[{ label: "Emergency" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Emergency Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Emergency department operations and case management
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCase(undefined);
            setFormOpen(true);
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4 inline-block mr-1 -mt-0.5" />
          New Case
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Siren className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{totalCases}</p>
              <p className="text-xs text-muted-foreground">Total Cases</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{waitingCases}</p>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{inTreatmentCases}</p>
              <p className="text-xs text-muted-foreground">In Treatment</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{admittedCases}</p>
              <p className="text-xs text-muted-foreground">Admitted</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by case ID, complaint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="All">All Status</option>
            <option value="Waiting">Waiting</option>
            <option value="In Treatment">In Treatment</option>
            <option value="Admitted">Admitted</option>
            <option value="Discharged">Discharged</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            value={triageFilter}
            onChange={(e) => setTriageFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Triage Levels</option>
            {TRIAGE_LEVELS.map((t) => (
              <option key={t} value={t}>Level {t}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={fetchCases}
            className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </form>

      {loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading emergency cases...</div>
      )}
      {error && (
        <div className="text-center py-12 text-destructive text-sm">{error}</div>
      )}
      {!loading && !error && (
        <EmergencyCaseTable cases={cases} onEdit={handleEdit} />
      )}

      <EmergencyCaseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingCase}
        mode={editingCase ? "edit" : "create"}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

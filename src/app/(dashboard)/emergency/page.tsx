"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Siren, Clock, Stethoscope, CheckCircle2, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { EmergencyCaseTable, EmergencyCaseForm, type EmergencyCase } from "@/components/emergency";
import { EMPTY_LIST_META, PaginationBar, type ListMeta } from "@/components/ui/pagination-bar";

const TRIAGE_LEVELS = [1, 2, 3, 4, 5];

export default function EmergencyPage() {
  const router = useRouter();

  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_LIST_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [triageFilter, setTriageFilter] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<EmergencyCase | undefined>(undefined);

  const fetchCases = useCallback(
    async (targetPage: number) => {
      let redirecting = false;
      try {
        setLoading(true);
        setError(null);
        setDenied(false);
        const params = new URLSearchParams();
        if (searchQuery) params.set("query", searchQuery);
        if (statusFilter !== "All") params.set("status", statusFilter);
        if (triageFilter) params.set("triageLevel", triageFilter);
        params.set("page", String(targetPage));
        params.set("pageSize", "10");

        const res = await fetch(`/api/emergency?${params.toString()}`);
        if (res.status === 401) {
          redirecting = true;
          router.push(`/login?callbackUrl=${encodeURIComponent("/emergency")}`);
          return;
        }
        if (res.status === 403) {
          setDenied(true);
          setCases([]);
          setMeta(EMPTY_LIST_META);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch emergency cases");
        const data = await res.json();
        setCases(Array.isArray(data.data) ? data.data : []);
        setMeta(data.meta ?? EMPTY_LIST_META);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load emergency cases");
        setCases([]);
        setMeta(EMPTY_LIST_META);
      } finally {
        if (!redirecting) setLoading(false);
      }
    },
    [searchQuery, statusFilter, triageFilter, router]
  );

  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (didInitialFetchRef.current) return;
    didInitialFetchRef.current = true;
    const load = async () => {
      await fetchCases(1);
    };
    load();
  }, [fetchCases]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCases(1);
  };

  const handleRefresh = () => {
    fetchCases(page);
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setPage(next);
    fetchCases(next);
  };

  const handleEdit = (emergencyCase: EmergencyCase) => {
    setEditingCase(emergencyCase);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingCase(undefined);
    fetchCases(page);
  };

  const totalCases = meta.total;
  const waitingCases = meta.statusCounts?.["Waiting"] ?? 0;
  const inTreatmentCases = meta.statusCounts?.["In Treatment"] ?? 0;
  const admittedCases = meta.statusCounts?.["Admitted"] ?? 0;

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

      {denied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view emergency cases.
          </p>
        </div>
      ) : (
        <>
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
                aria-label="Status"
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
                aria-label="Triage level"
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
                aria-label="Refresh list"
                type="button"
                onClick={handleRefresh}
                className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </form>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading emergency cases...</div>
          )}
          {error && !loading && (
            <div className="text-center py-12 text-sm">
              <p className="text-destructive mb-3">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !error && !denied && (
            <EmergencyCaseTable cases={cases} onEdit={handleEdit} />
          )}
          {!loading && !error && !denied && (
            <div className="mt-4">
              <PaginationBar meta={meta} onPageChange={handlePageChange} noun="case" />
            </div>
          )}
        </>
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

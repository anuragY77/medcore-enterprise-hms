"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Scissors, Clock, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SurgeryTable, SurgeryForm, type Surgery } from "@/components/surgery";
import { EMPTY_LIST_META, PaginationBar, type ListMeta } from "@/components/ui/pagination-bar";

const PROCEDURE_TYPES = [
  "Cardiac",
  "Orthopedic",
  "Neurological",
  "General",
  "Pediatric",
  "Oncology",
  "Plastic",
  "Transplant",
  "Emergency",
  "Other",
];

export default function SurgeryPage() {
  const router = useRouter();

  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_LIST_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [procedureTypeFilter, setProcedureTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState<Surgery | undefined>(undefined);

  const fetchSurgeries = useCallback(
    async (targetPage: number) => {
      let redirecting = false;
      try {
        setLoading(true);
        setError(null);
        setDenied(false);
        const params = new URLSearchParams();
        if (searchQuery) params.set("query", searchQuery);
        if (statusFilter !== "All") params.set("status", statusFilter);
        if (procedureTypeFilter) params.set("procedureType", procedureTypeFilter);
        params.set("page", String(targetPage));
        params.set("pageSize", "10");

        const res = await fetch(`/api/surgeries?${params.toString()}`);
        if (res.status === 401) {
          redirecting = true;
          router.push(`/login?callbackUrl=${encodeURIComponent("/surgery")}`);
          return;
        }
        if (res.status === 403) {
          setDenied(true);
          setSurgeries([]);
          setMeta(EMPTY_LIST_META);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch surgeries");
        const data = await res.json();
        setSurgeries(Array.isArray(data.data) ? data.data : []);
        setMeta(data.meta ?? EMPTY_LIST_META);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load surgeries");
        setSurgeries([]);
        setMeta(EMPTY_LIST_META);
      } finally {
        if (!redirecting) setLoading(false);
      }
    },
    [searchQuery, statusFilter, procedureTypeFilter, router]
  );

  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (didInitialFetchRef.current) return;
    didInitialFetchRef.current = true;
    const load = async () => {
      await fetchSurgeries(1);
    };
    load();
  }, [fetchSurgeries]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSurgeries(1);
  };

  const handleRefresh = () => {
    fetchSurgeries(page);
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setPage(next);
    fetchSurgeries(next);
  };

  const handleEdit = (surgery: Surgery) => {
    setEditingSurgery(surgery);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingSurgery(undefined);
    fetchSurgeries(page);
  };

  const totalSurgeries = meta.total;
  const scheduledSurgeries = meta.statusCounts?.["Scheduled"] ?? 0;
  const inProgressSurgeries = meta.statusCounts?.["In Progress"] ?? 0;
  const completedSurgeries = meta.statusCounts?.["Completed"] ?? 0;

  return (
    <div>
      <Breadcrumb items={[{ label: "Surgery" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Surgery & OT Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operating theater scheduling and surgical planning
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSurgery(undefined);
            setFormOpen(true);
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4 inline-block mr-1 -mt-0.5" />
          Schedule Surgery
        </button>
      </div>

      {denied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view surgeries.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Scissors className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{totalSurgeries}</p>
                  <p className="text-xs text-muted-foreground">Total Surgeries</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{scheduledSurgeries}</p>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{inProgressSurgeries}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{completedSurgeries}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by surgery ID, procedure, department..."
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
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Post-Op">Post-Op</option>
              </select>
              <select
                aria-label="Procedure type"
                value={procedureTypeFilter}
                onChange={(e) => setProcedureTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Procedure Types</option>
                {PROCEDURE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
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
            <div className="text-center py-12 text-muted-foreground text-sm">Loading surgeries...</div>
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
            <SurgeryTable surgeries={surgeries} onEdit={handleEdit} />
          )}
          {!loading && !error && !denied && (
            <div className="mt-4">
              <PaginationBar meta={meta} onPageChange={handlePageChange} noun="surgery" />
            </div>
          )}
        </>
      )}

      <SurgeryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingSurgery}
        mode={editingSurgery ? "edit" : "create"}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

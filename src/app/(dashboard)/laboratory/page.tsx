"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, TestTube, Clock, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LabTestTable, LabTestForm, LabResultDialog, type LabTest } from "@/components/laboratory";
import { EMPTY_LIST_META, PaginationBar, type ListMeta } from "@/components/ui/pagination-bar";
import { hasPermission, type Role } from "@/types/auth";

const CATEGORIES = [
  "Blood Test",
  "Urine Test",
  "X-Ray",
  "MRI",
  "CT Scan",
  "Ultrasound",
  "ECG",
  "Biopsy",
  "Culture",
  "Hematology",
  "Biochemistry",
  "Microbiology",
  "Immunology",
  "Pathology",
  "Pulmonary Function",
  "Endoscopy",
];

export default function LaboratoryPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [tests, setTests] = useState<LabTest[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_LIST_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTest | undefined>(undefined);

  const [resultTest, setResultTest] = useState<LabTest | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canWrite = session?.user?.role
    ? hasPermission(session.user.role as Role, "laboratory:write")
    : false;

  const fetchTests = useCallback(
    async (targetPage: number) => {
      let redirecting = false;
      try {
        setLoading(true);
        setError(null);
        setDenied(false);
        const params = new URLSearchParams();
        if (searchQuery) params.set("query", searchQuery);
        if (statusFilter !== "All") params.set("status", statusFilter);
        if (categoryFilter) params.set("category", categoryFilter);
        params.set("page", String(targetPage));
        params.set("pageSize", "10");

        const res = await fetch(`/api/laboratory?${params.toString()}`);
        if (res.status === 401) {
          redirecting = true;
          router.push(`/login?callbackUrl=${encodeURIComponent("/laboratory")}`);
          return;
        }
        if (res.status === 403) {
          setDenied(true);
          setTests([]);
          setMeta(EMPTY_LIST_META);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch lab tests");
        const data = await res.json();
        setTests(Array.isArray(data.data) ? data.data : []);
        setMeta(data.meta ?? EMPTY_LIST_META);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lab tests");
        setTests([]);
        setMeta(EMPTY_LIST_META);
      } finally {
        if (!redirecting) setLoading(false);
      }
    },
    [searchQuery, statusFilter, categoryFilter, router]
  );

  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (didInitialFetchRef.current) return;
    didInitialFetchRef.current = true;
    const load = async () => {
      await fetchTests(1);
    };
    load();
  }, [fetchTests]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTests(1);
  };

  const handleRefresh = () => {
    fetchTests(page);
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setPage(next);
    fetchTests(next);
  };

  const handleEdit = (test: LabTest) => {
    if (!canWrite) return;
    setActionError(null);
    setEditingTest(test);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingTest(undefined);
    fetchTests(page);
  };

  const handleProcess = async (test: LabTest) => {
    try {
      setProcessingId(test.id);
      setActionError(null);
      const res = await fetch(`/api/laboratory/${test.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        if (res.status === 401 || res.status === 403) {
          throw new Error("You do not have permission to process lab tests.");
        }
        if (res.status === 404) throw new Error("Lab test not found.");
        if (res.status === 409) throw new Error(err?.error || "Lab test is not pending.");
        throw new Error(err?.error || "Failed to process lab test");
      }
      await fetchTests(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenResult = (test: LabTest) => {
    setActionError(null);
    setResultTest(test);
    setResultOpen(true);
  };

  const handleResultSuccess = () => {
    setResultTest(null);
    setResultOpen(false);
    fetchTests(page);
  };

  const totalTests = meta.total;
  const pendingTests = meta.statusCounts?.["Pending"] ?? 0;
  const inProgressTests = meta.statusCounts?.["In Progress"] ?? 0;
  const completedTests = meta.statusCounts?.["Completed"] ?? 0;

  return (
    <div>
      <Breadcrumb items={[{ label: "Laboratory" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Laboratory & Diagnostics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test orders, results, and diagnostics
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => {
              setEditingTest(undefined);
              setFormOpen(true);
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4 inline-block mr-1 -mt-0.5" />
            Order Test
          </button>
        )}
      </div>

      {denied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view lab tests.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TestTube className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{totalTests}</p>
                  <p className="text-xs text-muted-foreground">Total Tests</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{pendingTests}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{inProgressTests}</p>
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
                  <p className="text-2xl font-semibold text-foreground">{completedTests}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by test ID, name, category, ordered by..."
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
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              <select
                aria-label="Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
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

          {!loading && actionError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              {actionError}
            </div>
          )}
          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading lab tests...</div>
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
            <LabTestTable
              tests={tests}
              onEdit={handleEdit}
              onProcess={handleProcess}
              onResult={handleOpenResult}
              processingId={processingId}
            />
          )}
          {!loading && !error && !denied && (
            <div className="mt-4">
              <PaginationBar meta={meta} onPageChange={handlePageChange} noun="test" />
            </div>
          )}
        </>
      )}

      <LabTestForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingTest}
        mode={editingTest ? "edit" : "create"}
        onSuccess={handleFormSuccess}
      />

      <LabResultDialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        test={resultTest}
        onSuccess={handleResultSuccess}
      />
    </div>
  );
}

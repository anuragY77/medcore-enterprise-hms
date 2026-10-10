"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shield, FileText, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ClaimTable, ClaimForm, type InsuranceClaim } from "@/components/insurance";
import { EMPTY_LIST_META, PaginationBar, type ListMeta } from "@/components/ui/pagination-bar";

export default function InsurancePage() {
  const router = useRouter();
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_LIST_META);
  const [denied, setDenied] = useState(false);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [providerFilter, setProviderFilter] = useState("");
  const [provider, setProvider] = useState("");
  const [searchTick, setSearchTick] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<InsuranceClaim | undefined>(undefined);

  const [patientFilter, setPatientFilter] = useState<string | null>(null);
  const patientFilterRef = useRef<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);

  const fetchClaims = useCallback(async () => {
    let redirecting = false;
    setLoading(true);
    setError(null);
    setDenied(false);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (provider) params.set("providerName", provider);
      if (patientFilterRef.current) params.set("patientId", patientFilterRef.current);
      params.set("page", String(page));
      params.set("pageSize", "10");

      const res = await fetch(`/api/insurance?${params.toString()}`);
      if (res.status === 401) {
        redirecting = true;
        router.push(`/login?callbackUrl=${encodeURIComponent("/insurance")}`);
        return;
      }
      if (res.status === 403) {
        setDenied(true);
        setClaims([]);
        setMeta(EMPTY_LIST_META);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch claims");
      const data = await res.json();
      setClaims(data.data);
      setMeta(data.meta ?? EMPTY_LIST_META);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load claims");
    } finally {
      if (!redirecting) setLoading(false);
    }
  }, [query, provider, statusFilter, page, router]);

  useEffect(() => {
    const load = async () => {
      const patientId = new URLSearchParams(window.location.search).get("patientId");
      if (patientId) {
        patientFilterRef.current = patientId;
        setPatientFilter(patientId);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const fetchKey = [query, provider, statusFilter, page, searchTick].join("|");
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    fetchClaims();
  }, [fetchClaims, query, provider, statusFilter, page, searchTick]);

  const clearPatientFilter = () => {
    patientFilterRef.current = null;
    setPatientFilter(null);
    setLoading(true);
    setPage(1);
    setSearchTick((tick) => tick + 1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setQuery(searchQuery);
    setProvider(providerFilter);
    setPage(1);
    setSearchTick((tick) => tick + 1);
  };

  const handleStatusFilter = (value: string) => {
    if (value === statusFilter) return;
    setLoading(true);
    setStatusFilter(value);
    setPage(1);
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  const handleEdit = (claim: InsuranceClaim) => {
    setEditingClaim(claim);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingClaim(undefined);
    fetchClaims();
  };

  const totalClaims = meta.total;
  const submittedClaims = meta.statusCounts?.["Submitted"] ?? 0;
  const processingClaims = meta.statusCounts?.["Processing"] ?? 0;
  const approvedClaims = meta.statusCounts?.["Approved"] ?? 0;
  const deniedClaims = meta.statusCounts?.["Denied"] ?? 0;

  return (
    <div>
      <Breadcrumb items={[{ label: "Insurance" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Insurance & Claims
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Insurance verification and claims processing
          </p>
        </div>
        <button
          onClick={() => {
            setEditingClaim(undefined);
            setFormOpen(true);
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4 inline-block mr-1 -mt-0.5" />
          Submit Claim
        </button>
      </div>

      {denied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view insurance claims.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{totalClaims}</p>
                  <p className="text-xs text-muted-foreground">Total Claims</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{submittedClaims}</p>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{processingClaims}</p>
                  <p className="text-xs text-muted-foreground">Processing</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{approvedClaims}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{deniedClaims}</p>
                  <p className="text-xs text-muted-foreground">Denied</p>
                </div>
              </div>
            </div>
          </div>

          {patientFilter && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filtered by patient:</span>
              <span className="font-mono text-xs px-2 py-1 rounded-md bg-muted text-foreground">
                {patientFilter}
              </span>
              <button
                onClick={clearPatientFilter}
                className="px-3 py-1.5 rounded-md border border-border/50 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by claim ID, provider, policy number, diagnosis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                aria-label="Claim status"
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="All">All Status</option>
                <option value="Submitted">Submitted</option>
                <option value="Processing">Processing</option>
                <option value="Approved">Approved</option>
                <option value="Denied">Denied</option>
              </select>
              <input
                type="text"
                placeholder="Filter by provider"
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Search
              </button>
              <button
                aria-label="Refresh list"
                type="button"
                onClick={fetchClaims}
                className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </form>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading insurance claims...</div>
          )}
          {error && !loading && (
            <div className="text-center py-12 text-sm">
              <p className="text-destructive mb-3">{error}</p>
              <button
                onClick={fetchClaims}
                className="px-4 py-2 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !error && (
            <ClaimTable claims={claims} onEdit={handleEdit} onUpdated={fetchClaims} />
          )}
          {!loading && !error && (
            <div className="mt-4">
              <PaginationBar meta={meta} onPageChange={handlePageChange} noun="claim" />
            </div>
          )}
        </>
      )}

      <ClaimForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingClaim}
        mode={editingClaim ? "edit" : "create"}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

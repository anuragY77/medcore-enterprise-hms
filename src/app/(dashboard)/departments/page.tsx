"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DepartmentTable, type Department } from "@/components/departments";
import { EMPTY_LIST_META, PaginationBar, type ListMeta } from "@/components/ui/pagination-bar";

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_LIST_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  const fetchDepartments = useCallback(async () => {
    setError(null);
    setDenied(false);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (statusFilter !== "All") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", "10");

      const res = await fetch(`/api/departments?${params.toString()}`);
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/departments")}`);
        return;
      }
      if (res.status === 403) {
        setDenied(true);
        setDepartments([]);
        setMeta(EMPTY_LIST_META);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch departments");
      const payload = (await res.json()) as { data?: Department[]; meta?: ListMeta };
      setDepartments(payload.data ?? []);
      setMeta(payload.meta ?? EMPTY_LIST_META);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load departments");
      setDepartments([]);
      setMeta(EMPTY_LIST_META);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, page, router]);

  useEffect(() => {
    const load = async () => {
      await fetchDepartments();
    };
    load();
  }, [fetchDepartments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (query === searchInput && page === 1) {
      fetchDepartments();
      return;
    }
    setQuery(searchInput);
    setPage(1);
  };

  const handleStatusFilter = (value: string) => {
    if (value === statusFilter) return;
    setLoading(true);
    setStatusFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchDepartments();
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Departments" }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Departments & Units
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hospital department management
        </p>
      </div>

      {denied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view departments.
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by name, ID, or head doctor..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                aria-label="Status"
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading departments...</div>
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
          {!loading && !error && (
            <DepartmentTable departments={departments} />
          )}
          {!loading && !error && !denied && (
            <div className="mt-4">
              <PaginationBar meta={meta} onPageChange={handlePageChange} noun="department" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

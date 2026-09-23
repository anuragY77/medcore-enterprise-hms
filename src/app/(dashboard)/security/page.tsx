"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  AuditLogTable,
  type AuditLogRecord,
  type AuditLogsMeta,
} from "@/components/security";
import { hasPermission, type Role } from "@/types/auth";

const EMPTY_META: AuditLogsMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };

function toDateParam(value: string, endOfDay: boolean): string {
  if (!value) return "";
  if (endOfDay) return `${value}T23:59:59`;
  return `${value}T00:00:00`;
}

export default function SecurityPage() {
  const { data: session, status } = useSession();

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [meta, setMeta] = useState<AuditLogsMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [successFilter, setSuccessFilter] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [success, setSuccess] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "audit:read") : false;

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (action) params.set("action", action);
      if (success) params.set("success", success);
      if (from) params.set("from", toDateParam(from, false));
      if (to) params.set("to", toDateParam(to, true));
      params.set("page", String(page));
      params.set("pageSize", "20");

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      setError(null);
      if (res.status === 401 || res.status === 403) {
        throw new Error("You do not have permission to view audit logs.");
      }
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const payload = await res.json();
      setLogs(payload.data ?? []);
      setMeta(payload.meta ?? EMPTY_META);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
      setLogs([]);
      setMeta(EMPTY_META);
    } finally {
      setLoading(false);
    }
  }, [search, action, success, from, to, page]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !canRead) return;
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (action) params.set("action", action);
        if (success) params.set("success", success);
        if (from) params.set("from", toDateParam(from, false));
        if (to) params.set("to", toDateParam(to, true));
        params.set("page", String(page));
        params.set("pageSize", "20");

        const res = await fetch(`/api/audit-logs?${params.toString()}`);
        if (res.status === 401 || res.status === 403) {
          throw new Error("You do not have permission to view audit logs.");
        }
        if (!res.ok) throw new Error("Failed to fetch audit logs");
        const payload = await res.json();
        setLogs(payload.data ?? []);
        setMeta(payload.meta ?? EMPTY_META);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit logs");
        setLogs([]);
        setMeta(EMPTY_META);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, canRead, search, action, success, from, to, page]);

  const applyFilters = () => {
    setLoading(true);
    const next = {
      search: searchInput.trim(),
      action: actionInput.trim(),
      success: successFilter,
      from: fromInput,
      to: toInput,
    };
    if (
      next.search === search &&
      next.action === action &&
      next.success === success &&
      next.from === from &&
      next.to === to &&
      page === 1
    ) {
      fetchLogs();
      return;
    }
    setSearch(next.search);
    setAction(next.action);
    setSuccess(next.success);
    setFrom(next.from);
    setTo(next.to);
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const handleSuccessFilter = (value: string) => {
    setLoading(true);
    setSuccessFilter(value);
    setSuccess(value);
    setPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchLogs();
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  const showAuthLoading = status === "loading";
  const showDenied = !showAuthLoading && (!session || !canRead);

  if (showAuthLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Audit Log" }]} />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Audit Log" }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Security Audit Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          System access and security monitoring
        </p>
      </div>

      {showDenied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            {!session
              ? "You must be signed in to view audit logs."
              : "You do not have permission to view audit logs."}
          </p>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSearch}
            className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm"
          >
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search action, entity, actor..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="text"
                placeholder="Action (exact)"
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-[160px]"
              />
              <select
                value={successFilter}
                onChange={(e) => handleSuccessFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Results</option>
                <option value="true">Success</option>
                <option value="false">Failed</option>
              </select>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                aria-label="From date"
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="date"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                aria-label="To date"
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </form>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Loading audit logs...
            </div>
          )}
          {error && !loading && (
            <div className="text-center py-12 text-destructive text-sm">{error}</div>
          )}
          {!loading && !error && (
            <AuditLogTable logs={logs} meta={meta} onPageChange={handlePageChange} />
          )}
        </>
      )}
    </div>
  );
}

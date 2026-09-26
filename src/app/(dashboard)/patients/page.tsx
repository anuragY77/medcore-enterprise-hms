"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, RefreshCw, Users } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  PatientTable,
  type PatientsMeta,
} from "@/components/patients/patient-table";
import { PatientSearch, PatientStatusFilter } from "@/components/patients/patient-search";
import { hasPermission, type Role } from "@/types/auth";
import type { Patient } from "@/types";

const EMPTY_META: PatientsMeta = { page: 1, pageSize: 10, total: 0, totalPages: 0 };
const SEARCH_DEBOUNCE_MS = 300;

export default function PatientsPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [meta, setMeta] = useState<PatientsMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "patients:read") : false;

  useEffect(() => {
    if (searchInput === query) return;
    const timer = setTimeout(() => {
      setLoading(true);
      setQuery(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, query]);

  const fetchPatients = useCallback(async () => {
    let redirecting = false;
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (statusFilter !== "All") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(EMPTY_META.pageSize));

      const res = await fetch(`/api/patients?${params.toString()}`);
      setError(null);
      if (res.status === 401) {
        redirecting = true;
        router.push("/login?callbackUrl=/patients");
        return;
      }
      if (res.status === 403) {
        throw new Error("You do not have permission to view patients.");
      }
      if (!res.ok) throw new Error("Failed to fetch patients");
      const payload = await res.json();
      if (!Array.isArray(payload.patients) || !payload.pagination) {
        throw new Error("Received an unexpected response from the server.");
      }
      setPatients(payload.patients);
      setMeta({
        page: payload.pagination.page ?? 1,
        pageSize: payload.pagination.pageSize ?? EMPTY_META.pageSize,
        total: payload.pagination.total ?? 0,
        totalPages: payload.pagination.totalPages ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients");
      setPatients([]);
      setMeta(EMPTY_META);
    } finally {
      if (!redirecting) setLoading(false);
    }
  }, [query, statusFilter, page, router]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session || !canRead) return;
    const load = async () => {
      await fetchPatients();
    };
    load();
  }, [sessionStatus, session, canRead, fetchPatients]);

  const handleStatusFilter = (value: string) => {
    if (value === statusFilter) return;
    setLoading(true);
    setStatusFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchPatients();
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  const showAuthLoading = sessionStatus === "loading";
  const showDenied = !showAuthLoading && (!session || !canRead);

  if (showAuthLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Patients" }]} />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Patients" }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Patient Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage patient registry, search, and profiles
          </p>
        </div>
        {canRead && !showDenied && (
          <button
            onClick={() => router.push("/patients/new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Patient
          </button>
        )}
      </div>

      {showDenied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            {!session
              ? "You must be signed in to view patients."
              : "You do not have permission to view patients."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <PatientSearch
              value={searchInput}
              onChange={setSearchInput}
              className="w-full sm:w-80"
            />
            <PatientStatusFilter value={statusFilter} onChange={handleStatusFilter} />
            <button
              onClick={handleRefresh}
              aria-label="Refresh patient list"
              className="p-2 rounded-md border border-border/50 text-muted-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="text-xs text-muted-foreground mb-3" aria-live="polite">
            {loading
              ? "Loading patients..."
              : `${meta.total} patient${meta.total !== 1 ? "s" : ""} found`}
          </div>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Loading patients...
            </div>
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
            <PatientTable patients={patients} meta={meta} onPageChange={handlePageChange} />
          )}
        </>
      )}
    </div>
  );
}

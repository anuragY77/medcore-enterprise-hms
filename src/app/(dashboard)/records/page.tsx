"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FileText, RefreshCw, User } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { RecordTable, type RecordRow, type RecordsMeta } from "@/components/records/record-table";
import { hasPermission, type Role } from "@/types/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const RECORD_TYPE_OPTIONS = ["Clinical", "Lab", "Imaging", "Administrative", "Discharge"];

const EMPTY_META: RecordsMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };

export default function RecordsHubPage() {
  const { data: session, status } = useSession();

  const [records, setRecords] = useState<RecordRow[]>([]);
  const [meta, setMeta] = useState<RecordsMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const [viewRecord, setViewRecord] = useState<RecordRow | null>(null);

  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "patients:read") : false;

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter) params.set("recordType", typeFilter);
    params.set("page", String(page));
    params.set("pageSize", "20");
    return params.toString();
  }, [search, typeFilter, page]);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/records?${buildParams()}`);
      setError(null);
      if (res.status === 401 || res.status === 403) {
        throw new Error("You do not have permission to view records.");
      }
      if (!res.ok) throw new Error("Failed to fetch records");
      const payload = await res.json();
      setRecords(payload.data ?? []);
      setMeta(payload.meta ?? EMPTY_META);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
      setRecords([]);
      setMeta(EMPTY_META);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !canRead) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/records?${buildParams()}`);
        if (res.status === 401 || res.status === 403) {
          throw new Error("You do not have permission to view records.");
        }
        if (!res.ok) throw new Error("Failed to fetch records");
        const payload = await res.json();
        setRecords(payload.data ?? []);
        setMeta(payload.meta ?? EMPTY_META);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load records");
        setRecords([]);
        setMeta(EMPTY_META);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, canRead, buildParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (search === searchInput && page === 1) {
      fetchRecords();
      return;
    }
    setSearch(searchInput);
    setPage(1);
  };

  const handleTypeFilter = (value: string) => {
    setLoading(true);
    setTypeFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchRecords();
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  const hasQuery = search !== "" || typeFilter !== "";

  const showAuthLoading = status === "loading";
  const showDenied = !showAuthLoading && (!session || !canRead);

  if (showAuthLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Records" }]} />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Records" }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Records Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized clinical records across all patients
          </p>
        </div>
      </div>

      {showDenied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            {!session
              ? "You must be signed in to view records."
              : "You do not have permission to view records."}
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
                placeholder="Search by title, provider, patient name or MRN..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={typeFilter}
                onChange={(e) => handleTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Types</option>
                {RECORD_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
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
                onClick={handleRefresh}
                className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </form>

          {!loading && !error && (
            <div className="text-xs text-muted-foreground mb-3">
              {meta.total} record{meta.total !== 1 ? "s" : ""} found
            </div>
          )}

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Loading records...
            </div>
          )}
          {error && !loading && (
            <div className="text-center py-12 text-destructive text-sm">
              <p>{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-3 px-4 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && (
            <RecordTable
              records={records}
              meta={meta}
              onPageChange={handlePageChange}
              onView={setViewRecord}
              emptyMessage={
                hasQuery
                  ? "No records match your search."
                  : "No records found."
              }
            />
          )}

          <Sheet open={!!viewRecord} onOpenChange={(o) => !o && setViewRecord(null)}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Record Details</SheetTitle>
                <SheetDescription>View clinical record information.</SheetDescription>
              </SheetHeader>
              {viewRecord && (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Title</p>
                    <p className="font-semibold text-foreground">{viewRecord.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Record Type</p>
                      <p className="text-foreground">{viewRecord.recordType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Record Date</p>
                      <p className="text-foreground">
                        {viewRecord.recordDate
                          ? new Date(viewRecord.recordDate).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Provider</p>
                      <p className="text-foreground">{viewRecord.recordedBy}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Created</p>
                      <p className="text-foreground">
                        {viewRecord.createdAt
                          ? new Date(viewRecord.createdAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {viewRecord.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <div className="rounded-md bg-muted/50 p-3 text-foreground whitespace-pre-wrap">
                        {viewRecord.description}
                      </div>
                    </div>
                  )}

                  {viewRecord.fileUrl && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Attachment</p>
                      <a
                        href={viewRecord.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        View attached file
                      </a>
                    </div>
                  )}

                  <div className="border-t border-border/50 pt-4">
                    <p className="text-xs text-muted-foreground mb-2">Patient</p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {viewRecord.patient.firstName} {viewRecord.patient.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {viewRecord.patient.patientId} · {viewRecord.patient.department}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/patients/${viewRecord.patient.id}`}
                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        View Patient
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

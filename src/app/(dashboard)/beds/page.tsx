"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BedGrid, RoomStatus, type Bed } from "@/components/beds";
import { hasPermission, type Role } from "@/types/auth";

const DEPARTMENTS = [
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Emergency",
  "Radiology",
  "Laboratory",
  "Pharmacy",
  "Administration",
  "Nursing",
];

type PatientOption = {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  status: string;
};

export default function BedsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [assignTarget, setAssignTarget] = useState<Bed | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Bed | null>(null);
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const patientsFetched = useRef(false);

  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "beds:read") : false;
  const canWrite = role ? hasPermission(role, "beds:write") : false;

  const fetchBeds = useCallback(
    async (filters?: { query?: string; status?: string; type?: string; department?: string }) => {
      let redirecting = false;
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        const q = filters?.query ?? searchQuery;
        const s = filters?.status ?? statusFilter;
        const t = filters?.type ?? typeFilter;
        const d = filters?.department ?? departmentFilter;
        if (q) params.set("query", q);
        if (s !== "All") params.set("status", s);
        if (t !== "All") params.set("type", t);
        if (d) params.set("department", d);
        params.set("pageSize", "100");

        const res = await fetch(`/api/beds?${params.toString()}`);
        if (res.status === 401) {
          redirecting = true;
          router.push("/login?callbackUrl=/beds");
          return;
        }
        if (res.status === 403) {
          throw new Error("You do not have permission to view beds.");
        }
        if (!res.ok) throw new Error("Failed to fetch beds");
        const data = await res.json();
        setBeds(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load beds");
        setBeds([]);
      } finally {
        if (!redirecting) setLoading(false);
      }
    },
    [router, searchQuery, statusFilter, typeFilter, departmentFilter]
  );

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session || !canRead) return;
    const load = async () => {
      await fetchBeds();
    };
    load();
  }, [sessionStatus, session, canRead, fetchBeds]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBeds();
  };

  const loadPatients = useCallback(async () => {
    if (patientsFetched.current) return;
    patientsFetched.current = true;
    setPatientsLoading(true);
    try {
      const res = await fetch("/api/patients?pageSize=100");
      if (!res.ok) throw new Error("Failed to fetch patients");
      const payload = await res.json();
      const rows: PatientOption[] = Array.isArray(payload.patients) ? payload.patients : [];
      setPatientOptions(rows.filter((p) => p.status !== "Discharged"));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to fetch patients");
      patientsFetched.current = false;
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  const handleAssign = (bed: Bed) => {
    setAssignTarget(bed);
    setActionError(null);
    setSelectedPatientId("");
    loadPatients();
  };

  const handleRelease = (bed: Bed) => {
    setReleaseTarget(bed);
    setActionError(null);
  };

  const closeAssign = (open: boolean) => {
    if (!open) {
      setAssignTarget(null);
      setActionError(null);
      setSelectedPatientId("");
    }
  };

  const closeRelease = (open: boolean) => {
    if (!open) {
      setReleaseTarget(null);
      setActionError(null);
    }
  };

  const submitAssign = async () => {
    if (!assignTarget || !selectedPatientId || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/beds/${assignTarget.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatientId }),
      });
      if (res.status === 401) {
        router.push("/login?callbackUrl=/beds");
        return;
      }
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Failed to assign bed"
        );
      }
      setAssignTarget(null);
      setSelectedPatientId("");
      await fetchBeds();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign bed");
    } finally {
      setActionBusy(false);
    }
  };

  const submitRelease = async () => {
    if (!releaseTarget || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/beds/${releaseTarget.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 401) {
        router.push("/login?callbackUrl=/beds");
        return;
      }
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Failed to release bed"
        );
      }
      setReleaseTarget(null);
      await fetchBeds();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to release bed");
    } finally {
      setActionBusy(false);
    }
  };

  const showAuthLoading = sessionStatus === "loading";
  const showDenied = !showAuthLoading && (!session || !canRead);

  if (showAuthLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Beds & Rooms" }]} />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (showDenied) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Beds & Rooms" }]} />
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center mt-6">
          <p className="text-sm text-muted-foreground">
            You do not have permission to view beds and rooms.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Beds & Rooms" }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Beds & Rooms Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bed occupancy and room status tracking
        </p>
      </div>

      {!loading && !error && <RoomStatus beds={beds} />}

      <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by bed ID, room, or ward..."
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
            <option value="Available">Available</option>
            <option value="Occupied">Occupied</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Reserved">Reserved</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="All">All Types</option>
            <option value="General">General</option>
            <option value="ICU">ICU</option>
            <option value="Private">Private</option>
            <option value="Semi-Private">Semi-Private</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
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
        <div className="text-center py-12 text-muted-foreground text-sm">Loading beds...</div>
      )}
      {error && (
        <div className="text-center py-12 text-destructive text-sm">{error}</div>
      )}
      {!loading && !error && (
        <BedGrid
          beds={beds}
          canWrite={canWrite}
          onAssign={handleAssign}
          onRelease={handleRelease}
        />
      )}

      <Sheet open={assignTarget !== null} onOpenChange={closeAssign}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Assign Patient{assignTarget ? ` — ${assignTarget.bedId}` : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {assignTarget && (
              <p className="text-sm text-muted-foreground">
                Room {assignTarget.roomNumber}
                {assignTarget.ward ? ` · ${assignTarget.ward}` : ""} ·{" "}
                {assignTarget.type} · {assignTarget.department}
              </p>
            )}
            {patientsLoading ? (
              <p className="text-sm text-muted-foreground">Loading patients...</p>
            ) : patientOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No patients available to assign.
              </p>
            ) : (
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select a patient...</option>
                {patientOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName}, {p.firstName} ({p.patientId})
                  </option>
                ))}
              </select>
            )}
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
            <button
              onClick={submitAssign}
              disabled={!selectedPatientId || actionBusy}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionBusy ? "Assigning..." : "Assign Patient"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={releaseTarget !== null} onOpenChange={closeRelease}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Release Bed{releaseTarget ? ` — ${releaseTarget.bedId}` : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              The bed will be marked Available and its patient link cleared. The
              patient&apos;s discharge is a separate step on their record.
            </p>
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
            <button
              onClick={submitRelease}
              disabled={actionBusy}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionBusy ? "Releasing..." : "Release Bed"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StaffTable, type StaffMember } from "@/components/staff";
import { EMPTY_LIST_META, PaginationBar, type ListMeta } from "@/components/ui/pagination-bar";

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

const ROLES = [
  "Doctor",
  "Nurse",
  "Receptionist",
  "Pharmacist",
  "Lab Technician",
  "Billing",
  "Security",
  "Administration",
];

export default function StaffPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_LIST_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchStaff = useCallback(async () => {
    setError(null);
    setDenied(false);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (roleFilter) params.set("role", roleFilter);
      params.set("page", String(page));
      params.set("pageSize", "10");

      const res = await fetch(`/api/staff?${params.toString()}`);
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/staff")}`);
        return;
      }
      if (res.status === 403) {
        setDenied(true);
        setStaffList([]);
        setMeta(EMPTY_LIST_META);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch staff");
      const payload = (await res.json()) as { data?: StaffMember[]; meta?: ListMeta };
      setStaffList(payload.data ?? []);
      setMeta(payload.meta ?? EMPTY_LIST_META);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
      setStaffList([]);
      setMeta(EMPTY_LIST_META);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, departmentFilter, roleFilter, page, router]);

  useEffect(() => {
    const load = async () => {
      await fetchStaff();
    };
    load();
  }, [fetchStaff]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (query === searchInput && page === 1) {
      fetchStaff();
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

  const handleDepartmentFilter = (value: string) => {
    if (value === departmentFilter) return;
    setLoading(true);
    setDepartmentFilter(value);
    setPage(1);
  };

  const handleRoleFilter = (value: string) => {
    if (value === roleFilter) return;
    setLoading(true);
    setRoleFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchStaff();
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Staff" }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Doctors & Staff Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Staff directory, profiles, and management
        </p>
      </div>

      {denied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view staff members.
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by name, ID, phone, or email..."
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
                <option value="On Leave">On Leave</option>
              </select>
              <select
                aria-label="Department"
                value={departmentFilter}
                onChange={(e) => handleDepartmentFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                aria-label="Role"
                value={roleFilter}
                onChange={(e) => handleRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
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
            <div className="text-center py-12 text-muted-foreground text-sm">Loading staff...</div>
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
            <StaffTable staff={staffList} />
          )}
          {!loading && !error && !denied && (
            <div className="mt-4">
              <PaginationBar meta={meta} onPageChange={handlePageChange} noun="staff member" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StaffTable, type StaffMember } from "@/components/staff";

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
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`/api/staff?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch staff");
      const data = await res.json();
      setStaffList(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/staff");
        if (!res.ok) throw new Error("Failed to fetch staff");
        const data = await res.json();
        setStaffList(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load staff");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStaff();
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

      <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, ID, phone, or email..."
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
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
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
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
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
      {error && (
        <div className="text-center py-12 text-destructive text-sm">{error}</div>
      )}
      {!loading && !error && (
        <StaffTable staff={staffList} />
      )}
    </div>
  );
}

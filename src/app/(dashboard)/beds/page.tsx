"use client";

import { useState, useEffect, useCallback } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BedGrid, RoomStatus, type Bed } from "@/components/beds";

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

export default function BedsPage() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const fetchBeds = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (typeFilter !== "All") params.set("type", typeFilter);
      if (departmentFilter) params.set("department", departmentFilter);

      const res = await fetch(`/api/beds?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch beds");
      const data = await res.json();
      setBeds(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load beds");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, typeFilter, departmentFilter]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/beds");
        if (!res.ok) throw new Error("Failed to fetch beds");
        const data = await res.json();
        setBeds(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load beds");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBeds();
  };

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
        <BedGrid beds={beds} />
      )}
    </div>
  );
}

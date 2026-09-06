"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, TestTube, Clock, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LabTestTable, LabTestForm, type LabTest } from "@/components/laboratory";

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
  const [tests, setTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTest | undefined>(undefined);

  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/laboratory?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch lab tests");
      const data = await res.json();
      setTests(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lab tests");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/laboratory");
        if (!res.ok) throw new Error("Failed to fetch lab tests");
        const data = await res.json();
        setTests(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lab tests");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTests();
  };

  const handleEdit = (test: LabTest) => {
    setEditingTest(test);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingTest(undefined);
    fetchTests();
  };

  const totalTests = tests.length;
  const pendingTests = tests.filter((t) => t.status === "Pending").length;
  const inProgressTests = tests.filter((t) => t.status === "In Progress").length;
  const completedTests = tests.filter((t) => t.status === "Completed").length;

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
      </div>

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
            type="button"
            onClick={fetchTests}
            className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </form>

      {loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading lab tests...</div>
      )}
      {error && (
        <div className="text-center py-12 text-destructive text-sm">{error}</div>
      )}
      {!loading && !error && (
        <LabTestTable tests={tests} onEdit={handleEdit} />
      )}

      <LabTestForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingTest}
        mode={editingTest ? "edit" : "create"}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

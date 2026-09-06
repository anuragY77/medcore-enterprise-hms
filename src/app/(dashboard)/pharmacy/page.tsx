"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pill, AlertTriangle, PackageX, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { MedicineTable, MedicineForm, type Medicine } from "@/components/pharmacy";

const CATEGORIES = [
  "Analgesics",
  "Antibiotics",
  "Antifungals",
  "Antihistamines",
  "Antihypertensives",
  "Antivirals",
  "Cardiovascular",
  "Dermatological",
  "Gastrointestinal",
  "Hormones",
  "Immunosuppressants",
  "Muscle Relaxants",
  "Neurological",
  "Ophthalmic",
  "Respiratory",
  "Vitamins & Supplements",
];

export default function PharmacyPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | undefined>(undefined);

  const fetchMedicines = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/pharmacy?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch medicines");
      const data = await res.json();
      setMedicines(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load medicines");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/pharmacy");
        if (!res.ok) throw new Error("Failed to fetch medicines");
        const data = await res.json();
        setMedicines(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load medicines");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMedicines();
  };

  const handleEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingMedicine(undefined);
    fetchMedicines();
  };

  const totalMedicines = medicines.length;
  const activeMedicines = medicines.filter((m) => m.status === "Active").length;
  const lowStock = medicines.filter(
    (m) => m.reorderLevel != null && m.stockQuantity <= m.reorderLevel
  ).length;
  const discontinued = medicines.filter((m) => m.status === "Discontinued").length;

  return (
    <div>
      <Breadcrumb items={[{ label: "Pharmacy" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Pharmacy Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Medication inventory and dispensing
          </p>
        </div>
        <button
          onClick={() => {
            setEditingMedicine(undefined);
            setFormOpen(true);
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4 inline-block mr-1 -mt-0.5" />
          Add Medicine
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pill className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{totalMedicines}</p>
              <p className="text-xs text-muted-foreground">Total Medicines</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Pill className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{activeMedicines}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{lowStock}</p>
              <p className="text-xs text-muted-foreground">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <PackageX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{discontinued}</p>
              <p className="text-xs text-muted-foreground">Discontinued</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by ID, name, generic name, category..."
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
            <option value="Discontinued">Discontinued</option>
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
            onClick={fetchMedicines}
            className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </form>

      {loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading medicines...</div>
      )}
      {error && (
        <div className="text-center py-12 text-destructive text-sm">{error}</div>
      )}
      {!loading && !error && (
        <MedicineTable medicines={medicines} onEdit={handleEdit} />
      )}

      <MedicineForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingMedicine}
        mode={editingMedicine ? "edit" : "create"}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

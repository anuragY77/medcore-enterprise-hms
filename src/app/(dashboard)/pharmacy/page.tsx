"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pill, AlertTriangle, PackageX, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { MedicineTable, MedicineForm, PrescriptionQueue, type Medicine } from "@/components/pharmacy";
import { EMPTY_LIST_META, PaginationBar, type ListMeta } from "@/components/ui/pagination-bar";

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
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_LIST_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | undefined>(undefined);

  const fetchMedicines = useCallback(
    async (silent = false) => {
      setError(null);
      setDenied(false);
      if (!silent) {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams();
        if (query) params.set("query", query);
        if (statusFilter !== "All") params.set("status", statusFilter);
        if (categoryFilter) params.set("category", categoryFilter);
        params.set("page", String(page));
        params.set("pageSize", "10");

        const res = await fetch(`/api/pharmacy?${params.toString()}`);
        if (res.status === 401) {
          router.push(`/login?callbackUrl=${encodeURIComponent("/pharmacy")}`);
          return;
        }
        if (res.status === 403) {
          setDenied(true);
          setMedicines([]);
          setMeta(EMPTY_LIST_META);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch medicines");
        const payload = (await res.json()) as { data?: Medicine[]; meta?: ListMeta };
        setMedicines(payload.data ?? []);
        setMeta(payload.meta ?? EMPTY_LIST_META);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load medicines");
        setMedicines([]);
        setMeta(EMPTY_LIST_META);
      } finally {
        setLoading(false);
      }
    },
    [query, statusFilter, categoryFilter, page, router]
  );

  useEffect(() => {
    const load = async () => {
      await fetchMedicines();
    };
    load();
  }, [fetchMedicines]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (query === searchInput && page === 1) {
      fetchMedicines();
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

  const handleCategoryFilter = (value: string) => {
    if (value === categoryFilter) return;
    setLoading(true);
    setCategoryFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchMedicines();
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  const handleEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingMedicine(undefined);
    fetchMedicines();
  };

  const totalMedicines = meta.total;
  const activeMedicines = meta.statusCounts?.["Active"] ?? 0;
  const lowStock = meta.lowStockCount ?? 0;
  const discontinued = meta.statusCounts?.["Discontinued"] ?? 0;

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

      {denied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view medicines.
          </p>
        </div>
      ) : (
        <>
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
                <option value="Discontinued">Discontinued</option>
              </select>
              <select
                aria-label="Category"
                value={categoryFilter}
                onChange={(e) => handleCategoryFilter(e.target.value)}
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
                aria-label="Refresh list"
                type="button"
                onClick={handleRefresh}
                className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </form>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading medicines...</div>
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
            <MedicineTable medicines={medicines} onEdit={handleEdit} />
          )}
          {!loading && !error && !denied && (
            <div className="mt-4">
              <PaginationBar meta={meta} onPageChange={handlePageChange} noun="medicine" />
            </div>
          )}
        </>
      )}

      <div className="mt-8">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            Prescription Queue
          </h2>
          <p className="text-sm text-muted-foreground">
            Verify stock and dispense active prescriptions
          </p>
        </div>
        <PrescriptionQueue onDispensed={() => fetchMedicines(true)} />
      </div>

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

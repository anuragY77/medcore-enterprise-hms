"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Package, AlertTriangle, PackageX, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { InventoryTable, InventoryForm, type InventoryItem } from "@/components/inventory";

const CATEGORIES = [
  "Medical Supplies",
  "Surgical Instruments",
  "PPE",
  "Cleaning Supplies",
  "Office Supplies",
  "Laboratory Supplies",
  "Pharmacy Supplies",
  "IT Equipment",
  "Furniture",
  "Linens",
  "Nutrition",
  "Radiology Supplies",
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/inventory?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch inventory items");
      const data = await res.json();
      setItems(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory items");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/inventory");
        if (!res.ok) throw new Error("Failed to fetch inventory items");
        const data = await res.json();
        setItems(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load inventory items");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setEditingItem(undefined);
    fetchItems();
  };

  const totalItems = items.length;
  const inStock = items.filter((i) => i.status === "In Stock").length;
  const lowStock = items.filter(
    (i) => i.reorderLevel != null && i.quantity <= i.reorderLevel && i.quantity > 0
  ).length;
  const outOfStock = items.filter((i) => i.quantity === 0).length;

  return (
    <div>
      <Breadcrumb items={[{ label: "Inventory" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Inventory Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Supply stock levels and reorder alerts
          </p>
        </div>
        <button
          onClick={() => {
            setEditingItem(undefined);
            setFormOpen(true);
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4 inline-block mr-1 -mt-0.5" />
          Add Item
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{totalItems}</p>
              <p className="text-xs text-muted-foreground">Total Items</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{inStock}</p>
              <p className="text-xs text-muted-foreground">In Stock</p>
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
              <p className="text-2xl font-semibold text-foreground">{outOfStock}</p>
              <p className="text-xs text-muted-foreground">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by ID, name, category, supplier..."
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
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
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
            onClick={fetchItems}
            className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </form>

      {loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading inventory items...</div>
      )}
      {error && (
        <div className="text-center py-12 text-destructive text-sm">{error}</div>
      )}
      {!loading && !error && (
        <InventoryTable items={items} onEdit={handleEdit} />
      )}

      <InventoryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingItem}
        mode={editingItem ? "edit" : "create"}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

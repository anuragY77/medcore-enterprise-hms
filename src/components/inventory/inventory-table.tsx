"use client";

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InventoryItem {
  id: string;
  itemId: string;
  name: string;
  category: string;
  description: string | null;
  supplier: string | null;
  quantity: number;
  reorderLevel: number | null;
  unit: string;
  unitPrice: number | null;
  location: string | null;
  status: string;
  lastRestockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InventoryTableProps {
  items: InventoryItem[];
  pageSize?: number;
  onEdit: (item: InventoryItem) => void;
}

type SortField = "itemId" | "name" | "category" | "supplier" | "quantity" | "unitPrice" | "location" | "status";
type SortDirection = "asc" | "desc";

const STATUS_COLORS: Record<string, string> = {
  "In Stock": "bg-emerald-100 text-emerald-800",
  "Low Stock": "bg-amber-100 text-amber-800",
  "Out of Stock": "bg-red-100 text-red-800",
};

function SortIcon({
  field,
  currentSort,
  direction,
}: {
  field: SortField;
  currentSort: SortField;
  direction: SortDirection;
}) {
  if (currentSort !== field) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  return direction === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5 text-primary" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-primary" />
  );
}

export function InventoryTable({ items, pageSize = 10, onEdit }: InventoryTableProps) {
  const [sortField, setSortField] = useState<SortField>("itemId");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortedItems = [...items].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedItems.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = sortedItems.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("itemId")}
              >
                <div className="flex items-center gap-1.5">
                  ID <SortIcon field="itemId" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1.5">
                  Name <SortIcon field="name" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("category")}
              >
                <div className="flex items-center gap-1.5">
                  Category <SortIcon field="category" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("supplier")}
              >
                <div className="flex items-center gap-1.5">
                  Supplier <SortIcon field="supplier" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("quantity")}
              >
                <div className="flex items-center gap-1.5">
                  Qty <SortIcon field="quantity" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Reorder
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Unit
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("location")}
              >
                <div className="flex items-center gap-1.5">
                  Location <SortIcon field="location" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Last Restocked
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1.5">
                  Status <SortIcon field="status" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                  No inventory items found.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-primary">{item.itemId}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.supplier || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "font-medium",
                      item.quantity === 0 ? "text-red-600" :
                      item.reorderLevel != null && item.quantity <= item.reorderLevel ? "text-amber-600" :
                      "text-foreground"
                    )}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.reorderLevel ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.location || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.lastRestockedAt
                      ? new Date(item.lastRestockedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-800"
                      )}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onEdit(item)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit item"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, sortedItems.length)} of{" "}
            {sortedItems.length} items
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  page === currentPage
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

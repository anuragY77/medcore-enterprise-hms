"use client";

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Medicine {
  id: string;
  medicineId: string;
  name: string;
  genericName: string | null;
  category: string;
  manufacturer: string | null;
  description: string | null;
  dosage: string | null;
  unit: string;
  stockQuantity: number;
  reorderLevel: number | null;
  unitPrice: number | null;
  expiryDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MedicineTableProps {
  medicines: Medicine[];
  pageSize?: number;
  onEdit: (medicine: Medicine) => void;
}

type SortField = "medicineId" | "name" | "genericName" | "category" | "stockQuantity" | "unitPrice" | "status";
type SortDirection = "asc" | "desc";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Inactive: "bg-slate-100 text-slate-800",
  Discontinued: "bg-red-100 text-red-800",
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

function isLowStock(medicine: Medicine): boolean {
  return medicine.reorderLevel != null && medicine.stockQuantity <= medicine.reorderLevel;
}

function isExpired(medicine: Medicine): boolean {
  if (!medicine.expiryDate) return false;
  return new Date(medicine.expiryDate) < new Date();
}

export function MedicineTable({ medicines, pageSize = 10, onEdit }: MedicineTableProps) {
  const [sortField, setSortField] = useState<SortField>("medicineId");
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

  const sortedMedicines = [...medicines].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedMedicines.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedMedicines = sortedMedicines.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("medicineId")}
              >
                <div className="flex items-center gap-1.5">
                  ID <SortIcon field="medicineId" currentSort={sortField} direction={sortDirection} />
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Generic Name
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("category")}
              >
                <div className="flex items-center gap-1.5">
                  Category <SortIcon field="category" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Dosage
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("stockQuantity")}
              >
                <div className="flex items-center gap-1.5">
                  Stock <SortIcon field="stockQuantity" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Reorder Level
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("unitPrice")}
              >
                <div className="flex items-center gap-1.5">
                  Unit Price <SortIcon field="unitPrice" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Expiry Date
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
            {paginatedMedicines.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                  No medicines found.
                </td>
              </tr>
            ) : (
              paginatedMedicines.map((medicine) => (
                <tr
                  key={medicine.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-primary">{medicine.medicineId}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{medicine.name}</span>
                      {isExpired(medicine) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          Expired
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{medicine.genericName || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{medicine.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{medicine.dosage || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium",
                        isLowStock(medicine) ? "text-amber-600" : "text-foreground"
                      )}>
                        {medicine.stockQuantity}
                      </span>
                      {isLowStock(medicine) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          Low
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{medicine.reorderLevel ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {medicine.unitPrice != null ? `$${medicine.unitPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {medicine.expiryDate
                      ? new Date(medicine.expiryDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[medicine.status] ?? "bg-slate-100 text-slate-800"
                      )}
                    >
                      {medicine.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onEdit(medicine)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit medicine"
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
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, sortedMedicines.length)} of{" "}
            {sortedMedicines.length} medicines
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

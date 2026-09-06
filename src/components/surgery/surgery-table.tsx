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

export interface Surgery {
  id: string;
  surgeryId: string;
  patientId: string;
  surgeonId: string;
  procedureName: string;
  procedureType: string;
  surgeryDate: string;
  estimatedDuration: number | null;
  operatingRoom: string | null;
  department: string;
  status: string;
  preOpNotes: string | null;
  postOpNotes: string | null;
  complications: string | null;
  anesthesiaType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SurgeryTableProps {
  surgeries: Surgery[];
  pageSize?: number;
  onEdit: (surgery: Surgery) => void;
}

type SortField = "surgeryId" | "procedureName" | "department" | "surgeryDate" | "status" | "operatingRoom";
type SortDirection = "asc" | "desc";

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "bg-amber-100 text-amber-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-red-100 text-red-800",
  "Post-Op": "bg-purple-100 text-purple-800",
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

export function SurgeryTable({ surgeries, pageSize = 10, onEdit }: SurgeryTableProps) {
  const [sortField, setSortField] = useState<SortField>("surgeryId");
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

  const sortedSurgeries = [...surgeries].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedSurgeries.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSurgeries = sortedSurgeries.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("surgeryId")}
              >
                <div className="flex items-center gap-1.5">
                  Surgery ID <SortIcon field="surgeryId" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("procedureName")}
              >
                <div className="flex items-center gap-1.5">
                  Procedure <SortIcon field="procedureName" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Patient
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Surgeon
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("department")}
              >
                <div className="flex items-center gap-1.5">
                  Department <SortIcon field="department" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("surgeryDate")}
              >
                <div className="flex items-center gap-1.5">
                  Date <SortIcon field="surgeryDate" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("operatingRoom")}
              >
                <div className="flex items-center gap-1.5">
                  OR <SortIcon field="operatingRoom" currentSort={sortField} direction={sortDirection} />
                </div>
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
            {paginatedSurgeries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No surgeries found.
                </td>
              </tr>
            ) : (
              paginatedSurgeries.map((surgery) => (
                <tr
                  key={surgery.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-primary">{surgery.surgeryId}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{surgery.procedureName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="font-mono text-xs">{surgery.patientId.slice(0, 8)}...</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="font-mono text-xs">{surgery.surgeonId.slice(0, 8)}...</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{surgery.department}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(surgery.surgeryDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{surgery.operatingRoom || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[surgery.status] ?? "bg-slate-100 text-slate-800"
                      )}
                    >
                      {surgery.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onEdit(surgery)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit surgery"
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
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, sortedSurgeries.length)} of{" "}
            {sortedSurgeries.length} surgeries
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

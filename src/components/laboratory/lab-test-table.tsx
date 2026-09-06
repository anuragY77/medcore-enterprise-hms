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

export interface LabTest {
  id: string;
  testId: string;
  patientId: string;
  consultationId: string | null;
  testName: string;
  category: string;
  orderedBy: string | null;
  status: string;
  result: string | null;
  notes: string | null;
  testDate: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LabTestTableProps {
  tests: LabTest[];
  pageSize?: number;
  onEdit: (test: LabTest) => void;
}

type SortField = "testId" | "testName" | "category" | "orderedBy" | "testDate" | "status";
type SortDirection = "asc" | "desc";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-800",
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

export function LabTestTable({ tests, pageSize = 10, onEdit }: LabTestTableProps) {
  const [sortField, setSortField] = useState<SortField>("testId");
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

  const sortedTests = [...tests].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedTests.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTests = sortedTests.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("testId")}
              >
                <div className="flex items-center gap-1.5">
                  Test ID <SortIcon field="testId" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("testName")}
              >
                <div className="flex items-center gap-1.5">
                  Test Name <SortIcon field="testName" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Patient
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
                onClick={() => handleSort("orderedBy")}
              >
                <div className="flex items-center gap-1.5">
                  Ordered By <SortIcon field="orderedBy" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("testDate")}
              >
                <div className="flex items-center gap-1.5">
                  Test Date <SortIcon field="testDate" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Completed
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
            {paginatedTests.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No laboratory tests found.
                </td>
              </tr>
            ) : (
              paginatedTests.map((test) => (
                <tr
                  key={test.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-primary">{test.testId}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{test.testName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="font-mono text-xs">{test.patientId.slice(0, 8)}...</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{test.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{test.orderedBy || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(test.testDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {test.completedAt
                      ? new Date(test.completedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[test.status] ?? "bg-slate-100 text-slate-800"
                      )}
                    >
                      {test.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onEdit(test)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit test"
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
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, sortedTests.length)} of{" "}
            {sortedTests.length} tests
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

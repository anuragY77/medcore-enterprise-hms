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

export interface InsuranceClaim {
  id: string;
  claimId: string;
  patientId: string;
  invoiceId: string | null;
  providerName: string;
  policyNumber: string;
  claimAmount: number;
  approvedAmount: number | null;
  status: string;
  diagnosis: string | null;
  treatmentCode: string | null;
  submittedDate: string | null;
  processedDate: string | null;
  denialReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClaimTableProps {
  claims: InsuranceClaim[];
  pageSize?: number;
  onEdit: (claim: InsuranceClaim) => void;
}

type SortField = "claimId" | "patientId" | "providerName" | "policyNumber" | "claimAmount" | "approvedAmount" | "submittedDate" | "status";
type SortDirection = "asc" | "desc";

const STATUS_COLORS: Record<string, string> = {
  Submitted: "bg-blue-100 text-blue-800",
  Processing: "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-800",
  Denied: "bg-red-100 text-red-800",
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function ClaimTable({ claims, pageSize = 10, onEdit }: ClaimTableProps) {
  const [sortField, setSortField] = useState<SortField>("claimId");
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

  const sortedClaims = [...claims].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedClaims.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedClaims = sortedClaims.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("claimId")}
              >
                <div className="flex items-center gap-1.5">
                  Claim ID <SortIcon field="claimId" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("patientId")}
              >
                <div className="flex items-center gap-1.5">
                  Patient <SortIcon field="patientId" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("providerName")}
              >
                <div className="flex items-center gap-1.5">
                  Provider <SortIcon field="providerName" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("policyNumber")}
              >
                <div className="flex items-center gap-1.5">
                  Policy # <SortIcon field="policyNumber" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-right px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("claimAmount")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Claim <SortIcon field="claimAmount" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-right px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("approvedAmount")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Approved <SortIcon field="approvedAmount" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("submittedDate")}
              >
                <div className="flex items-center gap-1.5">
                  Submitted <SortIcon field="submittedDate" currentSort={sortField} direction={sortDirection} />
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClaims.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No insurance claims found.
                </td>
              </tr>
            ) : (
              paginatedClaims.map((claim) => (
                <tr
                  key={claim.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-primary">{claim.claimId}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="font-mono text-xs">{claim.patientId.slice(0, 8)}...</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{claim.providerName}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{claim.policyNumber}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    ${formatCurrency(claim.claimAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    ${formatCurrency(claim.approvedAmount ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {claim.submittedDate ? new Date(claim.submittedDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[claim.status] ?? "bg-slate-100 text-slate-800"
                      )}
                    >
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onEdit(claim)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit claim"
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
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, sortedClaims.length)} of{" "}
            {sortedClaims.length} claims
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

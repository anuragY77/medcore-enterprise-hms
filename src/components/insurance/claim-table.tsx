"use client";

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RefreshCw,
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
  onUpdated: () => void;
}

type SortField = "claimId" | "patientId" | "providerName" | "policyNumber" | "claimAmount" | "approvedAmount" | "submittedDate" | "status";
type SortDirection = "asc" | "desc";

const STATUS_COLORS: Record<string, string> = {
  Submitted: "bg-blue-100 text-blue-800",
  Processing: "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-800",
  Denied: "bg-red-100 text-red-800",
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Submitted: ["Processing", "Approved", "Denied"],
  Processing: ["Approved", "Denied"],
  Approved: [],
  Denied: [],
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

export function ClaimTable({ claims, pageSize = 10, onEdit, onUpdated }: ClaimTableProps) {
  const [sortField, setSortField] = useState<SortField>("claimId");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const [statusTarget, setStatusTarget] = useState<InsuranceClaim | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const openStatusDialog = (claim: InsuranceClaim) => {
    setStatusTarget(claim);
    setNewStatus("");
    setApprovedAmount("");
    setDenialReason("");
    setStatusError(null);
  };

  const closeStatusDialog = () => {
    if (saving) return;
    setStatusTarget(null);
  };

  const handleStatusSubmit = async () => {
    if (!statusTarget || !newStatus || saving) return;

    const payload: Record<string, unknown> = { status: newStatus };

    if (newStatus === "Approved") {
      const amount = Number(approvedAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        setStatusError("Enter a valid approved amount");
        return;
      }
      if (amount > statusTarget.claimAmount) {
        setStatusError("Approved amount cannot exceed claim amount");
        return;
      }
      payload.approvedAmount = amount;
    }

    if (newStatus === "Denied" && denialReason.trim()) {
      payload.denialReason = denialReason.trim();
    }

    try {
      setSaving(true);
      setStatusError(null);
      const res = await fetch(`/api/insurance/${statusTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to update claim status");
      }
      setStatusTarget(null);
      onUpdated();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update claim status");
    } finally {
      setSaving(false);
    }
  };

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
                    <div className="flex items-center gap-1">
                      {(ALLOWED_TRANSITIONS[claim.status]?.length ?? 0) > 0 && (
                        <button
                          onClick={() => openStatusDialog(claim)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Update claim status"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(claim)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit claim"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
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

      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-1">Update Claim Status</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Claim <strong>{statusTarget.claimId}</strong> — current status{" "}
              <strong>{statusTarget.status}</strong>
            </p>

            {statusError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md text-sm mb-4">
                {statusError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  New Status <span className="text-destructive">*</span>
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select status</option>
                  {(ALLOWED_TRANSITIONS[statusTarget.status] ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {newStatus === "Approved" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Approved Amount <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={statusTarget.claimAmount}
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

              {newStatus === "Denied" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Denial Reason
                  </label>
                  <textarea
                    rows={2}
                    value={denialReason}
                    onChange={(e) => setDenialReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 justify-end mt-5">
              <button
                onClick={closeStatusDialog}
                disabled={saving}
                className="px-4 py-2 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusSubmit}
                disabled={saving || !newStatus}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

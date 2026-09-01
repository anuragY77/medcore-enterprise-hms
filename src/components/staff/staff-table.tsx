"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface StaffMember {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  specialization: string | null;
  qualification: string | null;
  experience: number | null;
  status: string;
  joiningDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffTableProps {
  staff: StaffMember[];
  pageSize?: number;
}

type SortField = "staffId" | "firstName" | "lastName" | "role" | "department" | "status";
type SortDirection = "asc" | "desc";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Inactive: "bg-slate-100 text-slate-800",
  "On Leave": "bg-amber-100 text-amber-800",
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

export function StaffTable({ staff, pageSize = 10 }: StaffTableProps) {
  const [sortField, setSortField] = useState<SortField>("createdAt" as SortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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

  const sortedStaff = [...staff].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedStaff.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedStaff = sortedStaff.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("staffId")}
              >
                <div className="flex items-center gap-1.5">
                  Staff ID <SortIcon field="staffId" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("lastName")}
              >
                <div className="flex items-center gap-1.5">
                  Name <SortIcon field="lastName" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Phone
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("department")}
              >
                <div className="flex items-center gap-1.5">
                  Department <SortIcon field="department" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Specialization
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1.5">
                  Status <SortIcon field="status" currentSort={sortField} direction={sortDirection} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedStaff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No staff members found.
                </td>
              </tr>
            ) : (
              paginatedStaff.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/staff/${member.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {member.staffId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{member.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.department}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.specialization || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[member.status] ?? "bg-slate-100 text-slate-800"
                      )}
                    >
                      {member.status}
                    </span>
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
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, sortedStaff.length)} of{" "}
            {sortedStaff.length} staff members
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

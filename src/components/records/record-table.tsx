"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface RecordRow {
  id: string;
  recordType: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  recordedBy: string;
  recordDate: string;
  createdAt: string;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    department: string;
    status: string;
  };
}

export interface RecordsMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface RecordTableProps {
  records: RecordRow[];
  meta: RecordsMeta;
  onPageChange: (page: number) => void;
  onView: (record: RecordRow) => void;
  emptyMessage?: string;
}

const RECORD_TYPE_COLORS: Record<string, string> = {
  Clinical: "bg-blue-100 text-blue-800",
  Lab: "bg-purple-100 text-purple-800",
  Imaging: "bg-amber-100 text-amber-800",
  Administrative: "bg-slate-100 text-slate-600",
  Discharge: "bg-emerald-100 text-emerald-800",
};

export function RecordTable({ records, meta, onPageChange, onView, emptyMessage }: RecordTableProps) {
  const { page, pageSize, total, totalPages } = meta;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Record</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Provider</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage ?? "No records found."}
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/patients/${record.patient.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {record.patient.firstName} {record.patient.lastName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{record.patient.patientId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        RECORD_TYPE_COLORS[record.recordType] ?? "bg-slate-100 text-slate-600"
                      )}
                    >
                      {record.recordType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate max-w-[220px]">{record.title}</p>
                    {record.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                        {record.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.recordedBy}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {record.recordDate ? new Date(record.recordDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onView(record)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="View record"
                      >
                        <Eye className="h-4 w-4" />
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
            Showing {start}–{end} of {total} records
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
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

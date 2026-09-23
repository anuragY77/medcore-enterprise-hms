"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/types/auth";

export interface AuditLogActor {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  avatar: string | null;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  timestamp: string;
  severity: string | null;
  category: string | null;
  success: boolean | null;
  metadata: unknown;
  actor: AuditLogActor | null;
}

export interface AuditLogsMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AuditLogTableProps {
  logs: AuditLogRecord[];
  meta: AuditLogsMeta;
  onPageChange: (page: number) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-800",
  DEBUG: "bg-slate-100 text-slate-800",
  WARNING: "bg-amber-100 text-amber-800",
  WARN: "bg-amber-100 text-amber-800",
  ERROR: "bg-red-100 text-red-800",
  CRITICAL: "bg-red-100 text-red-800",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function AuditLogTable({ logs, meta, onPageChange }: AuditLogTableProps) {
  const { page, pageSize, total, totalPages } = meta;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Severity</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No audit events match the current filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    {log.actor ? (
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                          {log.actor.avatar ||
                            initials(log.actor.name || log.actor.email || "?")}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {log.actor.name || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {log.actor.email}
                            {log.actor.role
                              ? ` · ${ROLE_LABELS[log.actor.role as Role] ?? log.actor.role}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{log.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.entityType ? (
                      <div className="min-w-0">
                        <p className="truncate">{log.entityType}</p>
                        {log.entityId && (
                          <p className="text-xs truncate opacity-70">{log.entityId}</p>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{log.category || "—"}</td>
                  <td className="px-4 py-3">
                    {log.severity ? (
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          SEVERITY_COLORS[log.severity.toUpperCase()] ??
                            "bg-slate-100 text-slate-800"
                        )}
                      >
                        {log.severity}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.success === null || log.success === undefined ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          log.success
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        )}
                      >
                        {log.success ? "Success" : "Failed"}
                      </span>
                    )}
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
            Showing {start}–{end} of {total} events
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

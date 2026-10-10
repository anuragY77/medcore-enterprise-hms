"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Per-status row counts over the current filter, when the API provides them. */
  statusCounts?: Record<string, number>;
  /** Pharmacy: rows at/below reorder level over the current filter. */
  lowStockCount?: number;
  /** Inventory: quantity-based buckets over the current filter. */
  stock?: { inStock: number; lowStock: number; outOfStock: number };
}

export const EMPTY_LIST_META: ListMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
};

interface PaginationBarProps {
  meta: ListMeta;
  onPageChange: (page: number) => void;
  /** Lower-case singular noun for the range caption, e.g. "invoice". */
  noun: string;
}

/**
 * Shared footer pager for module list pages. Mirrors the PatientTable footer
 * (range caption + page-number buttons + prev/next) so every paginated list
 * exposes rows beyond the first server page instead of silently truncating.
 */
export function PaginationBar({ meta, onPageChange, noun }: PaginationBarProps) {
  const { page, pageSize, total, totalPages } = meta;
  const startIndex = (page - 1) * pageSize;
  const shownFrom = total === 0 ? 0 : startIndex + 1;
  const shownTo = Math.min(startIndex + pageSize, total);
  const plural =
    total === 1
      ? noun
      : noun.endsWith("y")
        ? `${noun.slice(0, -1)}ies`
        : `${noun}s`;

  if (total === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {`Showing ${shownFrom}–${shownTo} of ${total} ${plural}`}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
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
          disabled={page >= totalPages}
          aria-label="Next page"
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

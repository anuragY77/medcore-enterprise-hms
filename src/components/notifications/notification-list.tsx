"use client";

import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NotificationItem,
  type NotificationRecord,
  type NotificationsMeta,
} from "./notification-item";

interface NotificationListProps {
  notifications: NotificationRecord[];
  search: string;
  hasFilters: boolean;
  meta: NotificationsMeta;
  markingId: string | null;
  actionError: { id: string; message: string } | null;
  onMarkRead: (id: string) => void;
  onPageChange: (page: number) => void;
}

export function NotificationList({
  notifications,
  search,
  hasFilters,
  meta,
  markingId,
  actionError,
  onMarkRead,
  onPageChange,
}: NotificationListProps) {
  const { page, pageSize, total, totalPages } = meta;

  const query = search.trim().toLowerCase();
  const visible = query
    ? notifications.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query)
      )
    : notifications;

  if (notifications.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? "No notifications match your current filters."
            : "No notifications found."}
        </p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
        <p className="text-sm text-muted-foreground">
          No notifications match your current filters.
        </p>
      </div>
    );
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="p-4 flex flex-col gap-3">
        {visible.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            pending={markingId === notification.id}
            actionError={actionError?.id === notification.id ? actionError.message : null}
            onMarkRead={onMarkRead}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing {start}–{end} of {total} notifications
          </p>
          <div className="flex flex-wrap items-center gap-1">
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
              disabled={page === totalPages}
              aria-label="Next page"
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

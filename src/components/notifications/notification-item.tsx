"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  Info,
  Loader2,
  Receipt,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface NotificationRecord {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  readAt: string | null;
  action: string | null;
  createdAt: string;
}

export interface NotificationsMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const TYPE_STYLES: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; pill: string }
> = {
  SYSTEM: { label: "System", icon: Info, pill: "bg-slate-100 text-slate-800" },
  APPOINTMENT: { label: "Appointment", icon: CalendarDays, pill: "bg-blue-100 text-blue-800" },
  PATIENT: { label: "Patient", icon: Stethoscope, pill: "bg-teal-100 text-teal-800" },
  BILLING: { label: "Billing", icon: Receipt, pill: "bg-amber-100 text-amber-800" },
  SECURITY: { label: "Security", icon: ShieldAlert, pill: "bg-red-100 text-red-800" },
};

function formatTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

/**
 * Only allow plain internal paths (e.g. "/patients/123").
 * Rejects protocol-relative URLs, backslashes and anything with a scheme.
 */
function safeInternalPath(action: string | null): string | null {
  if (!action) return null;
  const value = action.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\s\\]/.test(value)) return null;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) return null;
  return value;
}

interface NotificationItemProps {
  notification: NotificationRecord;
  pending: boolean;
  actionError: string | null;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({
  notification,
  pending,
  actionError,
  onMarkRead,
}: NotificationItemProps) {
  const unread = !notification.isRead;
  const typeStyle = TYPE_STYLES[notification.type] ?? TYPE_STYLES.SYSTEM;
  const TypeIcon = typeStyle.icon;
  const openPath = safeInternalPath(notification.action);

  return (
    <article
      className={cn(
        "rounded-lg border bg-card shadow-sm px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        unread
          ? "border-border/50 border-l-2 border-l-primary bg-primary/[0.03]"
          : "border-border/50"
      )}
      aria-label={unread ? `${notification.title} (unread)` : notification.title}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className="relative shrink-0 mt-0.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <TypeIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </span>
          {unread && (
            <span
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card"
              aria-hidden="true"
            />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "text-sm text-foreground break-words",
                unread ? "font-semibold" : "font-medium"
              )}
            >
              {notification.title}
            </h3>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                typeStyle.pill
              )}
            >
              {typeStyle.label}
            </span>
            {unread && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary shrink-0">
                Unread
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-muted-foreground break-words whitespace-pre-wrap">
            {notification.message}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatTimestamp(notification.createdAt)}
            </span>
            {!unread && (
              <span>
                {notification.readAt
                  ? `Read · ${formatTimestamp(notification.readAt)}`
                  : "Read"}
              </span>
            )}
          </div>

          {actionError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {actionError}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 sm:justify-end">
        {unread && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMarkRead(notification.id)}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            {pending ? "Marking..." : "Mark as read"}
          </Button>
        )}
        {openPath && (
          <Link
            href={openPath}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted transition-colors"
          >
            Open
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  NotificationFilters,
  NotificationList,
  type NotificationRecord,
  type NotificationsMeta,
} from "@/components/notifications";
import { hasPermission, type Role } from "@/types/auth";

const EMPTY_META: NotificationsMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };

export default function NotificationsPage() {
  const { data: session, status } = useSession();

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [meta, setMeta] = useState<NotificationsMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [read, setRead] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const [markingId, setMarkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "notifications:read") : false;

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (read) params.set("read", read);
      if (type) params.set("type", type);
      params.set("page", String(page));
      params.set("pageSize", "20");

      const res = await fetch(`/api/notifications?${params.toString()}`);
      setError(null);
      if (res.status === 401) {
        throw new Error("You must be signed in to view notifications.");
      }
      if (res.status === 403) {
        throw new Error("You do not have permission to view notifications.");
      }
      if (!res.ok) throw new Error("Failed to fetch notifications.");
      const payload = await res.json();
      if (!payload || !Array.isArray(payload.data)) {
        throw new Error("Received an unexpected response from the server.");
      }
      setNotifications(payload.data as NotificationRecord[]);
      const m = payload.meta;
      setMeta(
        m &&
          typeof m.page === "number" &&
          typeof m.pageSize === "number" &&
          typeof m.total === "number" &&
          typeof m.totalPages === "number"
          ? (m as NotificationsMeta)
          : EMPTY_META
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
      setNotifications([]);
      setMeta(EMPTY_META);
    } finally {
      setLoading(false);
    }
  }, [read, type, page]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !canRead) return;
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (read) params.set("read", read);
        if (type) params.set("type", type);
        params.set("page", String(page));
        params.set("pageSize", "20");

        const res = await fetch(`/api/notifications?${params.toString()}`);
        if (res.status === 401) {
          throw new Error("You must be signed in to view notifications.");
        }
        if (res.status === 403) {
          throw new Error("You do not have permission to view notifications.");
        }
        if (!res.ok) throw new Error("Failed to fetch notifications.");
        const payload = await res.json();
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error("Received an unexpected response from the server.");
        }
        setNotifications(payload.data as NotificationRecord[]);
        const m = payload.meta;
        setMeta(
          m &&
            typeof m.page === "number" &&
            typeof m.pageSize === "number" &&
            typeof m.total === "number" &&
            typeof m.totalPages === "number"
            ? (m as NotificationsMeta)
            : EMPTY_META
        );
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load notifications.");
        setNotifications([]);
        setMeta(EMPTY_META);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, canRead, read, type, page]);

  const handleReadChange = (value: string) => {
    setLoading(true);
    setRead(value);
    setPage(1);
  };

  const handleTypeChange = (value: string) => {
    setLoading(true);
    setType(value);
    setPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchNotifications();
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  const handleMarkRead = async (id: string) => {
    if (markingId) return;
    setMarkingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (res.status === 401) {
        throw new Error("You must be signed in to update notifications.");
      }
      if (res.status === 403) {
        throw new Error("You do not have permission to update notifications.");
      }
      if (!res.ok) throw new Error("Failed to mark the notification as read.");
      const payload = await res.json();
      const updated = payload?.data;
      if (!updated || typeof updated.isRead !== "boolean") {
        throw new Error("Received an unexpected response from the server.");
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                isRead: updated.isRead,
                readAt:
                  typeof updated.readAt === "string" ? updated.readAt : n.readAt,
              }
            : n
        )
      );
    } catch (err) {
      setActionError({
        id,
        message:
          err instanceof Error ? err.message : "Failed to update the notification.",
      });
    } finally {
      setMarkingId(null);
    }
  };

  const showAuthLoading = status === "loading";
  const showDenied = !showAuthLoading && (!session || !canRead);
  const hasFilters = Boolean(search.trim() || read || type);

  if (showAuthLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Notifications" }]} />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Notifications" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay up to date with system activity and important alerts.
          </p>
        </div>
        {!showDenied && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            aria-label="Refresh notifications"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </Button>
        )}
      </div>

      {showDenied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            {!session
              ? "You must be signed in to view notifications."
              : "You do not have permission to view notifications."}
          </p>
        </div>
      ) : (
        <>
          <NotificationFilters
            searchInput={search}
            onSearchChange={setSearch}
            read={read}
            onReadChange={handleReadChange}
            type={type}
            onTypeChange={handleTypeChange}
          />

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm" aria-live="polite">
              Loading notifications...
            </div>
          )}
          {error && !loading && (
            <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleRefresh}
              >
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && (
            <NotificationList
              notifications={notifications}
              search={search}
              hasFilters={hasFilters}
              meta={meta}
              markingId={markingId}
              actionError={actionError}
              onMarkRead={handleMarkRead}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}

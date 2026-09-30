"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { hasPermission, type Role } from "@/types/auth";

export const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed";

const POLL_INTERVAL_MS = 20_000;
const COUNT_NOTIFS_PATH = "/api/notifications/unread-count";
const NOTIFICATIONS_PATH = "/notifications";

function compactCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function NotificationBell() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [count, setCount] = useState<{ owner: string | null; value: number }>({
    owner: null,
    value: 0,
  });
  const inFlight = useRef(false);

  const role = session?.user?.role as Role | undefined;
  const userId = session?.user?.id as string | undefined;
  const canRead = role ? hasPermission(role, "notifications:read") : false;
  const active = status === "authenticated" && Boolean(userId) && canRead;

  const refresh = useCallback(async () => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(COUNT_NOTIFS_PATH);
      if (res.status === 401 || res.status === 403 || !res.ok) return;
      const payload = await res.json();
      const raw = payload?.data?.count;
      if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
        setCount({ owner: userId, value: Math.floor(raw) });
      }
    } catch {
    } finally {
      inFlight.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!active) return;
    const boot = setTimeout(() => {
      void refresh();
    }, 0);
    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(boot);
      clearInterval(timer);
    };
  }, [active, refresh]);

  useEffect(() => {
    if (!active || pathname !== NOTIFICATIONS_PATH) return;
    const boot = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(boot);
  }, [active, pathname, refresh]);

  useEffect(() => {
    if (!active) return;
    const onChange = () => {
      void refresh();
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
  }, [active, refresh]);

  const visibleCount = active && count.owner === userId ? count.value : 0;
  const label =
    visibleCount > 0
      ? `Notifications, ${compactCount(visibleCount)} unread`
      : "Notifications";

  return (
    <Link
      href={NOTIFICATIONS_PATH}
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {visibleCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
        >
          {compactCount(visibleCount)}
        </span>
      )}
    </Link>
  );
}

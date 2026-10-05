"use client";

// Phase 19: client half of the idle timeout — activity pings and the
// advance warning. The SERVER is authoritative: this component only ever
// OBSERVES input to decide when to notify the server (POST /api/auth/activity,
// server timestamps the write) and when to show a countdown. The countdown
// uses the same input-quiet clock the server enforces, but it is a
// convenience: if the server has already expired the session, the next ping
// returns 401 and this tab redirects to the login page — the banner never
// asserts that the server still considers the session valid.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  activityPingIntervalSeconds,
  idleWarningSecondsBefore,
} from "@/lib/session-config";

const INPUT_EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"] as const;

function formatRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function SessionActivityMonitor() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastInputRef = useRef(0);
  const lastPingRef = useRef(0);
  const expiredRef = useRef(false);

  const idle = session?.idleTimeoutSeconds ?? 0;
  const sessionId = session?.sessionId;
  const warnBefore = idle > 0 ? idleWarningSecondsBefore(idle) : 0;
  const pingIntervalMs =
    idle > 0 ? activityPingIntervalSeconds(idle) * 1000 : 0;
  const authenticated = status === "authenticated" && Boolean(sessionId) && idle > 0;

  useEffect(() => {
    // Render-time guard (`authenticated`) already hides the banner without
    // a synchronous setState here (react-hooks/set-state-in-effect).
    if (!authenticated) return;

    const now = () => Date.now();
    lastInputRef.current = now();
    lastPingRef.current = now();
    expiredRef.current = false;

    const ping = async () => {
      if (expiredRef.current) return;
      if (now() - lastPingRef.current < pingIntervalMs) return;
      lastPingRef.current = now();
      try {
        const response = await fetch("/api/auth/activity", {
          method: "POST",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          expiredRef.current = true;
          setRemaining(null);
          const callback = encodeURIComponent(
            window.location.pathname + window.location.search
          );
          router.push(`/login?error=SessionExpired&callbackUrl=${callback}`);
        }
      } catch {
        // Transient failure (offline, restart): the next input retries; if
        // the session really expired, the server rejects it then.
      }
    };

    const onInput = () => {
      lastInputRef.current = now();
      setRemaining(null);
      void ping();
    };
    for (const event of INPUT_EVENTS) {
      window.addEventListener(event, onInput, { passive: true });
    }

    const ticker = window.setInterval(() => {
      const quietSeconds = (now() - lastInputRef.current) / 1000;
      const left = idle - quietSeconds;
      if (left <= 0) {
        // The server expires the session at this point; discovery happens
        // on the next navigation, data fetch, or ping — not from here.
        setRemaining(null);
        return;
      }
      setRemaining(left <= warnBefore ? Math.ceil(left) : null);
    }, 1000);

    return () => {
      for (const event of INPUT_EVENTS) {
        window.removeEventListener(event, onInput);
      }
      window.clearInterval(ticker);
    };
  }, [authenticated, idle, warnBefore, pingIntervalMs, router]);

  if (!authenticated || remaining === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="session-idle-warning"
      className="fixed bottom-4 right-4 z-50 max-w-sm bg-card border border-border rounded-lg shadow-lg p-4"
    >
      <p className="text-sm font-medium text-foreground">
        Your session ends in {formatRemaining(remaining)} of inactivity.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Move, click, or type to stay signed in.
      </p>
    </div>
  );
}

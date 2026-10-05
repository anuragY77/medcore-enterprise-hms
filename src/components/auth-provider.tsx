"use client";

import { SessionProvider } from "next-auth/react";
import { SessionActivityMonitor } from "@/components/auth/session-activity-monitor";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      {/* Phase 19: input-driven activity pings + idle expiry warning. */}
      <SessionActivityMonitor />
    </SessionProvider>
  );
}

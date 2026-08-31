"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserPlus, CalendarDays, PillBottle, FlaskConical, ClipboardList } from "lucide-react";
import { hasPermission, type Role } from "@/types/auth";

interface QuickAction {
  label: string;
  href: string;
  icon: typeof UserPlus;
  permission: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Register Patient",
    href: "/patients/new",
    icon: UserPlus,
    permission: "patients:write",
  },
  {
    label: "New Appointment",
    href: "/appointments",
    icon: CalendarDays,
    permission: "appointments:write",
  },
  {
    label: "View Pharmacy",
    href: "/pharmacy",
    icon: PillBottle,
    permission: "pharmacy:read",
  },
  {
    label: "Lab Results",
    href: "/laboratory",
    icon: FlaskConical,
    permission: "laboratory:read",
  },
  {
    label: "Users & Roles",
    href: "/users",
    icon: ClipboardList,
    permission: "users:read",
  },
];

export function QuickActions() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;

  const visibleActions = role
    ? QUICK_ACTIONS.filter((action) => hasPermission(role, action.permission))
    : [];

  if (visibleActions.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
        Quick Actions
      </h2>
      <div className="space-y-2">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 px-3 py-2 rounded text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{action.label}</span>
              <span className="text-muted-foreground">&rarr;</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

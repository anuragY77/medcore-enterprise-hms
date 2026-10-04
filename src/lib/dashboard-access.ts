// Role-aware visibility for GET /api/dashboard/stats (Phase 17).
//
// Product decisions (derived from the existing RBAC table, documented for
// review — see Phase 17 report §E):
// - Every authenticated role may see the operational dashboard: it is the
//   app's landing page for all nine roles, and the shared blocks are
//   non-identifying aggregates (patient/bed/appointment/department counts),
//   not record-level data.
// - `financial` (invoice totals, outstanding balance) requires `billing:read`
//   — ADMIN, RECEPTIONIST, BILLING. Other roles receive `null` and the
//   dashboard hides the Billing Summary card.
// - `activity` (recent audit-log entries: sign-ins, account changes, warning
//   severities) requires `audit:read` — ADMIN, SECURITY. Other roles receive
//   an empty list, which the existing timeline renders as "No recent
//   activity." without any UI redesign.
import { hasPermission, type Role } from "@/types/auth";

export interface DashboardVisibility {
  financial: boolean;
  activity: boolean;
}

export function dashboardVisibility(role: Role): DashboardVisibility {
  return {
    financial: hasPermission(role, "billing:read"),
    activity: hasPermission(role, "audit:read"),
  };
}

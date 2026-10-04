import { describe, expect, it } from "vitest";
import { dashboardVisibility } from "@/lib/dashboard-access";
import { ROLES, hasPermission, type Role } from "@/types/auth";

const ALL_ROLES = Object.values(ROLES);

describe("dashboardVisibility", () => {
  it("grants financial data exactly to roles holding billing:read", () => {
    for (const role of ALL_ROLES) {
      expect(dashboardVisibility(role).financial).toBe(
        hasPermission(role, "billing:read")
      );
    }
    expect(
      ALL_ROLES.filter((r) => dashboardVisibility(r).financial)
    ).toEqual(["ADMIN", "RECEPTIONIST", "BILLING"]);
  });

  it("grants the audit activity feed exactly to roles holding audit:read", () => {
    for (const role of ALL_ROLES) {
      expect(dashboardVisibility(role).activity).toBe(
        hasPermission(role, "audit:read")
      );
    }
    expect(
      ALL_ROLES.filter((r) => dashboardVisibility(r).activity)
    ).toEqual(["ADMIN", "SECURITY"]);
  });

  it("keeps clinical and front-desk roles on the operational dashboard only", () => {
    const operationalOnly: Role[] = [
      "DOCTOR",
      "NURSE",
      "PHARMACIST",
      "LAB_TECHNICIAN",
      "SURGEON",
    ];
    for (const role of operationalOnly) {
      expect(dashboardVisibility(role)).toEqual({
        financial: false,
        activity: false,
      });
    }
  });
});

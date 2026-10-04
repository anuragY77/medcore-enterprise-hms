import { describe, expect, it } from "vitest";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  type Role,
} from "@/types/auth";

const ALL_ROLES = Object.values(ROLES);

describe("ROLES / ROLE_LABELS", () => {
  it("defines exactly 9 roles", () => {
    expect(ALL_ROLES).toHaveLength(9);
  });

  it("has a display label for every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });
});

describe("ROLE_PERMISSIONS matrix (imported from the real implementation)", () => {
  it("grants permissions to every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it("spans 41 unique permission keys across the matrix", () => {
    const union = new Set(ALL_ROLES.flatMap((role) => ROLE_PERMISSIONS[role]));
    expect(union.size).toBe(41);
  });

  it("gives ADMIN every key except security:read", () => {
    // Observed reality of the implementation: "security:read" is granted only
    // to SECURITY and is referenced nowhere else in src/. ADMIN holds the
    // other 40 keys, including audit:read (which gates the security UI data).
    const union = new Set(ALL_ROLES.flatMap((role) => ROLE_PERMISSIONS[role]));
    const admin = new Set(ROLE_PERMISSIONS.ADMIN);
    expect(admin.size).toBe(40);
    expect([...union].filter((key) => !admin.has(key))).toEqual([
      "security:read",
    ]);
  });

  it("restricts destructive patient access to ADMIN only", () => {
    const holders = ALL_ROLES.filter((role) =>
      ROLE_PERMISSIONS[role].includes("patients:delete")
    );
    expect(holders).toEqual(["ADMIN"]);
  });

  it("restricts user management to ADMIN only", () => {
    for (const key of ["users:write", "users:delete", "users:read"]) {
      const holders = ALL_ROLES.filter((role) =>
        ROLE_PERMISSIONS[role].includes(key)
      );
      expect(holders).toEqual(["ADMIN"]);
    }
  });

  it("keeps audit log access to ADMIN and SECURITY", () => {
    const holders = ALL_ROLES.filter((role) =>
      ROLE_PERMISSIONS[role].includes("audit:read")
    );
    expect(holders.sort()).toEqual(["ADMIN", "SECURITY"]);
  });

  it("denies clinical write access to non-clinical roles", () => {
    expect(hasPermission("SECURITY", "patients:write")).toBe(false);
    expect(hasPermission("BILLING", "patients:write")).toBe(false);
    expect(hasPermission("SECURITY", "billing:write")).toBe(false);
    expect(hasPermission("DOCTOR", "billing:write")).toBe(false);
    expect(hasPermission("NURSE", "laboratory:write")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("allows explicitly granted permissions", () => {
    expect(hasPermission("ADMIN", "patients:write")).toBe(true);
    expect(hasPermission("DOCTOR", "patients:read")).toBe(true);
    expect(hasPermission("NURSE", "nursing:write")).toBe(true);
    expect(hasPermission("PHARMACIST", "pharmacy:write")).toBe(true);
    expect(hasPermission("BILLING", "billing:write")).toBe(true);
    expect(hasPermission("LAB_TECHNICIAN", "laboratory:write")).toBe(true);
    expect(hasPermission("RECEPTIONIST", "appointments:write")).toBe(true);
    expect(hasPermission("SURGEON", "surgery:write")).toBe(true);
    expect(hasPermission("SECURITY", "security:read")).toBe(true);
  });

  it("denies permissions the role was never granted", () => {
    expect(hasPermission("RECEPTIONIST", "patients:delete")).toBe(false);
    expect(hasPermission("PHARMACIST", "reports:read")).toBe(false);
    expect(hasPermission("DOCTOR", "settings:write")).toBe(false);
    expect(hasPermission("SECURITY", "audit:write")).toBe(false);
  });

  it("returns false for unknown permission strings", () => {
    expect(hasPermission("ADMIN", "nonexistent:permission")).toBe(false);
    expect(hasPermission("ADMIN", "")).toBe(false);
  });

  it("returns false for an unknown role instead of throwing", () => {
    const bogus = "GHOST_ROLE" as Role;
    expect(hasPermission(bogus, "patients:read")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("passes when at least one permission is granted", () => {
    expect(
      hasAnyPermission("DOCTOR", ["billing:write", "patients:read"])
    ).toBe(true);
  });

  it("fails when none are granted", () => {
    expect(hasAnyPermission("SECURITY", ["patients:write", "billing:write"])).toBe(
      false
    );
  });

  it("fails on an empty list", () => {
    expect(hasAnyPermission("ADMIN", [])).toBe(false);
  });
});

export const ROLES = {
  ADMIN: "ADMIN",
  DOCTOR: "DOCTOR",
  NURSE: "NURSE",
  RECEPTIONIST: "RECEPTIONIST",
  PHARMACIST: "PHARMACIST",
  LAB_TECHNICIAN: "LAB_TECHNICIAN",
  BILLING: "BILLING",
  SURGEON: "SURGEON",
  SECURITY: "SECURITY",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Receptionist",
  PHARMACIST: "Pharmacist",
  LAB_TECHNICIAN: "Lab Technician",
  BILLING: "Billing Specialist",
  SURGEON: "Surgeon",
  SECURITY: "Security",
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: [
    "patients:read",
    "patients:write",
    "patients:delete",
    "staff:read",
    "staff:write",
    "staff:delete",
    "appointments:read",
    "appointments:write",
    "appointments:delete",
    "billing:read",
    "billing:write",
    "billing:delete",
    "pharmacy:read",
    "pharmacy:write",
    "laboratory:read",
    "laboratory:write",
    "reports:read",
    "reports:write",
    "settings:read",
    "settings:write",
    "users:read",
    "users:write",
    "users:delete",
    "audit:read",
    "departments:read",
    "departments:write",
    "beds:read",
    "beds:write",
    "emergency:read",
    "emergency:write",
    "surgery:read",
    "surgery:write",
    "insurance:read",
    "insurance:write",
    "inventory:read",
    "inventory:write",
    "nursing:read",
    "nursing:write",
  ],
  DOCTOR: [
    "patients:read",
    "patients:write",
    "appointments:read",
    "appointments:write",
    "laboratory:read",
    "pharmacy:read",
    "reports:read",
    "departments:read",
    "beds:read",
    "emergency:read",
    "surgery:read",
    "nursing:read",
  ],
  NURSE: [
    "patients:read",
    "patients:write",
    "appointments:read",
    "laboratory:read",
    "pharmacy:read",
    "beds:read",
    "nursing:read",
    "nursing:write",
    "emergency:read",
  ],
  RECEPTIONIST: [
    "patients:read",
    "patients:write",
    "appointments:read",
    "appointments:write",
    "billing:read",
    "insurance:read",
    "departments:read",
    "beds:read",
  ],
  PHARMACIST: [
    "patients:read",
    "pharmacy:read",
    "pharmacy:write",
    "inventory:read",
    "inventory:write",
    "laboratory:read",
  ],
  LAB_TECHNICIAN: [
    "patients:read",
    "laboratory:read",
    "laboratory:write",
    "reports:read",
  ],
  BILLING: [
    "patients:read",
    "billing:read",
    "billing:write",
    "insurance:read",
    "insurance:write",
    "reports:read",
  ],
  SURGEON: [
    "patients:read",
    "patients:write",
    "appointments:read",
    "surgery:read",
    "surgery:write",
    "laboratory:read",
    "beds:read",
    "emergency:read",
  ],
  SECURITY: [
    "audit:read",
    "security:read",
    "patients:read",
    "staff:read",
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  avatar?: string;
}

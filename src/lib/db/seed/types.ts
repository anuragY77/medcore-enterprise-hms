import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/lib/db/schema";

/** Root Drizzle database handle (node-postgres driver). */
export type Db = NodePgDatabase<typeof schema>;

/** Transaction handle passed to every domain seeder. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface DoctorRef {
  staffId: string;
  /** Display name used across appointments/records ("Dr. Arjun Mehta"). */
  name: string;
  department: string;
}

export interface PatientPlan {
  /** Natural key, e.g. "PT-10482". */
  patientId: string;
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Other";
  dateOfBirth: Date;
  department: string;
  attendingDoctor: string;
  status: "Active" | "Discharged" | "Critical";
  /** True when this patient has an admission record + (unless discharged) an occupied bed. */
  admitted: boolean;
  discharged: boolean;
  insured: boolean;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  createdAt: Date;
}

export interface AppointmentRef {
  appointmentId: string;
  id: string;
  patientId: string;
  status: string;
  date: Date;
}

/**
 * Cross-domain identifier maps. Child rows must reference the *actual*
 * primary keys that exist (seeded or pre-existing), never assumed values.
 */
export interface SeedContext {
  /** email -> users.id (includes the five demo accounts). */
  users: Map<string, string>;
  /** department name -> departments.id. */
  departments: Map<string, string>;
  /** staffId (STF-xxx) -> staff.id. */
  staff: Map<string, string>;
  /** Doctors, in seed order. */
  doctors: DoctorRef[];
  /** patientId (PT-xxxxx) -> patients.id. */
  patients: Map<string, string>;
  /** Generated patient plans (status/admission shape) for dependent domains. */
  plans: PatientPlan[];
  /** appointmentId (APT-xxx) -> appointments.id. */
  appointments: Map<string, string>;
  /** Appointments grouped by patient natural key, in date order. */
  appointmentsByPatient: Map<string, AppointmentRef[]>;
  /** consultation key -> consultations.id. */
  consultations: Map<string, string>;
  /** invoiceId (INV-xxx) -> invoices.id. */
  invoices: Map<string, string>;
  /** Deterministic clock for the run; all relative dates derive from it. */
  now: Date;
}

/** Per-domain upsert tallies, printed by the CLI and asserted by tests. */
export type SeedCounts = Record<string, number>;

export function createSeedContext(now: Date): SeedContext {
  return {
    users: new Map(),
    departments: new Map(),
    staff: new Map(),
    doctors: [],
    patients: new Map(),
    plans: [],
    appointments: new Map(),
    appointmentsByPatient: new Map(),
    consultations: new Map(),
    invoices: new Map(),
    now,
  };
}

/** Date offset (days, may be negative) from the run's anchor time. */
export function daysFrom(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** Date offset in hours from the run's anchor time. */
export function hoursFrom(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

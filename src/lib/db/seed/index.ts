import { seedCore } from "./core";
import { syncBusinessIdCounters } from "@/lib/business-id";
import { seedClinical } from "./clinical";
import {
  seedAppointments,
  seedEmergency,
  seedNotifications,
  seedSurgeries,
} from "./operations";
import { seedRevenue } from "./revenue";
import { seedSupply } from "./supply";
import { createSeedContext, type SeedCounts, type Tx } from "./types";

/**
 * Run every domain seeder inside the caller's transaction.
 *
 * Order matters (FK dependencies):
 *   core (departments → users → staff → patients → beds)
 *   → appointments (needs patients)
 *   → emergency + surgeries (need patients/staff)
 *   → clinical (needs patients/appointments/consultations)
 *   → revenue (needs patients/appointments)
 *   → supply (standalone)
 *   → notifications (needs users)
 *
 * Everything is upsert-based: no DELETE/TRUNCATE ever runs, and stable
 * identifiers make a second run converge instead of duplicating.
 */
export async function seedAll(tx: Tx): Promise<SeedCounts> {
  const now = new Date();
  const ctx = createSeedContext(now);
  const counts: SeedCounts = {};

  Object.assign(counts, await seedCore(tx, ctx));
  Object.assign(counts, await seedAppointments(tx, ctx));
  Object.assign(counts, await seedEmergency(tx, ctx));
  Object.assign(counts, await seedSurgeries(tx, ctx));
  Object.assign(counts, await seedClinical(tx, ctx));
  Object.assign(counts, await seedRevenue(tx, ctx));
  Object.assign(counts, await seedSupply(tx, ctx));
  Object.assign(counts, await seedNotifications(tx, ctx));

  // Phase 17: keep the atomic business-ID counters at or above every seeded
  // identifier (idempotent GREATEST upsert — a second seed run does not push
  // counters forward).
  await syncBusinessIdCounters(tx);

  return counts;
}

export { assertSeedTarget, SeedGuardError, parseSeedTarget } from "./guard";
export { buildBedRows, buildPatientPlans } from "./core";
export { createSeedContext, daysFrom, hoursFrom } from "./types";

// Atomic, monotonic allocation for human-visible business identifiers
// (APT-001, STF-004, PT-10482, …).
//
// Why not `count(*) + 1`: a row count shrinks after deletions (an old ID is
// reissued and the unique constraint then rejects the insert) and two
// concurrent requests can read the same count and collide. The previous
// implementation had exactly those defects across 12 endpoints.
//
// Design:
// - `business_id_counters.next_value` stores the HIGHEST value ever issued
//   per prefix. Allocation is a single atomic UPDATE ... RETURNING, so
//   concurrent creates serialize on the row and never share an ID, and a
//   deleted row's number is never reused.
// - Missing counter rows bootstrap from the target table's current maximum
//   (whitelisted identifiers only — `spec.table`/`spec.column` are static
//   registry constants, never user input), so the helper is safe on databases
//   that were migrated but never seeded.
// - The per-column UNIQUE constraint remains the final integrity boundary.
//   With monotonic allocation a 23505 can only occur if someone manually
//   inserts a colliding ID; endpoints surface their existing generic 500 and
//   beds keeps its bounded retry loop (each attempt allocates a fresh ID).
// - Counter updates join the caller's transaction: a rolled-back create
//   rolls back its allocation too (no gaps, no reuse).
import { eq, sql } from "drizzle-orm";
import { businessIdCounters } from "@/lib/db";
import type { Db, Tx } from "@/lib/db/seed/types";

export type BusinessIdDb = Db | Tx;

export interface BusinessIdSpec {
  prefix: string;
  /** Physical table name (registry constant — never interpolated from input). */
  table: string;
  /** Physical column holding the business ID (registry constant). */
  column: string;
  /** Zero-pad width; 0 renders the number unpadded (e.g. PT-10482). */
  pad: number;
  /** First value issued on a completely empty table. */
  base: number;
}

export const BUSINESS_IDS = {
  APT: { prefix: "APT", table: "appointments", column: "appointment_id", pad: 3, base: 1 },
  SRG: { prefix: "SRG", table: "surgeries", column: "surgery_id", pad: 3, base: 1 },
  ITM: { prefix: "ITM", table: "inventory_items", column: "item_id", pad: 3, base: 1 },
  MED: { prefix: "MED", table: "pharmacy_medicines", column: "medicine_id", pad: 3, base: 1 },
  STF: { prefix: "STF", table: "staff", column: "staff_id", pad: 3, base: 1 },
  BED: { prefix: "BED", table: "beds", column: "bed_id", pad: 3, base: 1 },
  INV: { prefix: "INV", table: "invoices", column: "invoice_id", pad: 3, base: 1 },
  DEPT: { prefix: "DEPT", table: "departments", column: "department_id", pad: 3, base: 1 },
  CLM: { prefix: "CLM", table: "insurance_claims", column: "claim_id", pad: 3, base: 1 },
  EMC: { prefix: "EMC", table: "emergency_cases", column: "case_id", pad: 3, base: 1 },
  LAB: { prefix: "LAB", table: "lab_tests", column: "test_id", pad: 3, base: 1 },
  PT: { prefix: "PT", table: "patients", column: "patient_id", pad: 0, base: 10482 },
} as const satisfies Record<string, BusinessIdSpec>;

export type BusinessIdKey = keyof typeof BUSINESS_IDS;

// Fail fast at module load if a registry entry could ever be unsafe to
// interpolate into the bootstrap SQL (identifiers are static code, but the
// assertion keeps future edits honest).
for (const spec of Object.values(BUSINESS_IDS)) {
  if (!/^[a-z_]+$/.test(spec.table) || !/^[a-z_]+$/.test(spec.column)) {
    throw new Error(`unsafe business id registry entry: ${spec.prefix}`);
  }
}

export function formatBusinessId(key: BusinessIdKey, value: number): string {
  const spec = BUSINESS_IDS[key];
  const rendered = spec.pad > 0 ? String(value).padStart(spec.pad, "0") : String(value);
  return `${spec.prefix}-${rendered}`;
}

/**
 * Highest business-ID number currently present in the target table, or
 * `base - 1` when the table has none (so the first issued value is `base`).
 */
async function currentTableMax(
  exec: BusinessIdDb,
  spec: BusinessIdSpec
): Promise<number> {
  const result = await exec.execute<{ floor: number | string }>(
    // `\\d` is required: a lone `\d` in a JS template literal would collapse
    // to `d` and silently break the trailing-number extraction.
    sql`SELECT COALESCE(MAX(CAST(SUBSTRING(${sql.identifier(spec.column)} FROM '\\d+$') AS INT)), ${spec.base - 1}) AS floor FROM ${sql.identifier(spec.table)}`
  );
  const floor = Number(result.rows[0]?.floor);
  if (!Number.isInteger(floor) || floor < spec.base - 1) {
    throw new Error(`failed to derive business id floor for ${spec.prefix}`);
  }
  return floor;
}

/**
 * Allocate the next identifier for `key`. Atomic under concurrency; never
 * reuses a previously issued number.
 */
export async function nextBusinessId(
  exec: BusinessIdDb,
  key: BusinessIdKey
): Promise<string> {
  const spec = BUSINESS_IDS[key];

  // Fast path: counter row exists — one atomic increment.
  const [updated] = await exec
    .update(businessIdCounters)
    .set({ nextValue: sql`${businessIdCounters.nextValue} + 1` })
    .where(eq(businessIdCounters.prefix, spec.prefix))
    .returning({ nextValue: businessIdCounters.nextValue });
  if (updated) {
    return formatBusinessId(key, updated.nextValue);
  }

  // Bootstrap (no counter row yet): start above the table's current maximum.
  const start = (await currentTableMax(exec, spec)) + 1;
  const [inserted] = await exec
    .insert(businessIdCounters)
    .values({ prefix: spec.prefix, nextValue: start })
    .onConflictDoUpdate({
      target: businessIdCounters.prefix,
      // A concurrent bootstrapper won the INSERT: continue from their value.
      set: { nextValue: sql`${businessIdCounters.nextValue} + 1` },
    })
    .returning({ nextValue: businessIdCounters.nextValue });
  if (!inserted) {
    throw new Error(`failed to allocate business id for ${spec.prefix}`);
  }
  return formatBusinessId(key, inserted.nextValue);
}

/**
 * Raise (never lower) each counter to at least the highest number present in
 * its table. Idempotent — safe to run on every seed — so a second seed run
 * does not push counters forward, and seeding after API-created rows cannot
 * hand out an ID that is already taken.
 */
export async function syncBusinessIdCounters(exec: BusinessIdDb): Promise<void> {
  for (const spec of Object.values(BUSINESS_IDS)) {
    const floor = await currentTableMax(exec, spec);
    await exec
      .insert(businessIdCounters)
      .values({ prefix: spec.prefix, nextValue: floor })
      .onConflictDoUpdate({
        target: businessIdCounters.prefix,
        set: {
          nextValue: sql`GREATEST(${businessIdCounters.nextValue}, ${floor})`,
        },
      });
  }
}

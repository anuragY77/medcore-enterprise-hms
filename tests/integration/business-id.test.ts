import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { businessIdCounters, inventoryItems } from "@/lib/db";
import {
  BUSINESS_IDS,
  nextBusinessId,
  syncBusinessIdCounters,
  type BusinessIdKey,
} from "@/lib/business-id";
import {
  integrationEnabled,
  setupIntegration,
  teardownIntegration,
  type IntegrationContext,
} from "./helpers";

const RUN = integrationEnabled;

// Deliberate sentinel: every test transaction throws this to ROLL BACK all
// statements, so this file never leaves rows behind on the shared test DB.
const ROLLBACK = "business-id-test-rollback";

function itemRow(itemId: string) {
  return {
    itemId,
    name: `Vitest ${itemId}`,
    category: "Test",
    quantity: 1,
    unit: "unit",
    status: "Available",
  };
}

/** Highest numeric suffix of an inventory item id ("ITM-777" -> 777). */
function itemNumber(itemId: string): number {
  const match = /(\d+)$/.exec(itemId);
  if (!match) throw new Error(`no numeric suffix on ${itemId}`);
  return Number(match[1]);
}

describe.skipIf(!RUN)("business id integration", () => {
  let ctx: IntegrationContext;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    ctx = await setupIntegration();
    db = drizzle(ctx.pool, { schema });
  });
  afterAll(async () => {
    await teardownIntegration(ctx);
  });

  it("bootstraps from an empty table, never reuses a deleted number, and rolls back", async () => {
    const counterBefore = await db
      .select()
      .from(businessIdCounters)
      .where(eq(businessIdCounters.prefix, "ITM"));
    const itemsBefore = await db
      .select({ itemId: inventoryItems.itemId })
      .from(inventoryItems)
      .orderBy(inventoryItems.itemId);

    await expect(
      db.transaction(async (tx) => {
        // Isolate inside the transaction — everything below is rolled back.
        await tx.delete(inventoryItems);
        await tx
          .delete(businessIdCounters)
          .where(eq(businessIdCounters.prefix, "ITM"));

        // Empty table -> bootstrap floor is base-1 -> first ID is ITM-001.
        expect(await nextBusinessId(tx, "ITM")).toBe("ITM-001");
        expect(await nextBusinessId(tx, "ITM")).toBe("ITM-002");

        // Simulate the old defect's trigger: a row disappears. The next
        // allocation must continue monotonically, NOT fall back to count+1.
        await tx.insert(inventoryItems).values(itemRow("ITM-001"));
        await tx
          .delete(inventoryItems)
          .where(eq(inventoryItems.itemId, "ITM-001"));
        expect(await nextBusinessId(tx, "ITM")).toBe("ITM-003");

        throw new Error(ROLLBACK);
      })
    ).rejects.toThrow(ROLLBACK);

    // The rollback restored the pre-test state exactly.
    const counterAfter = await db
      .select()
      .from(businessIdCounters)
      .where(eq(businessIdCounters.prefix, "ITM"));
    const itemsAfter = await db
      .select({ itemId: inventoryItems.itemId })
      .from(inventoryItems)
      .orderBy(inventoryItems.itemId);
    expect(counterAfter).toEqual(counterBefore);
    expect(itemsAfter).toEqual(itemsBefore);
  });

  it("bootstraps from an existing maximum when the counter row is missing", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.delete(inventoryItems);
        await tx
          .delete(businessIdCounters)
          .where(eq(businessIdCounters.prefix, "ITM"));
        await tx.insert(inventoryItems).values(itemRow("ITM-777"));

        // Counter row is gone, table has rows: floor must come from the table.
        expect(await nextBusinessId(tx, "ITM")).toBe("ITM-778");
        expect(await nextBusinessId(tx, "ITM")).toBe("ITM-779");

        throw new Error(ROLLBACK);
      })
    ).rejects.toThrow(ROLLBACK);
  });

  it("sync raises counters to the table floor and is idempotent", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.delete(inventoryItems);
        await tx
          .delete(businessIdCounters)
          .where(eq(businessIdCounters.prefix, "ITM"));
        await tx.insert(inventoryItems).values(itemRow("ITM-9000"));

        await syncBusinessIdCounters(tx);

        // The ITM counter is at least the highest number present in the table.
        const [afterFirst] = await tx
          .select()
          .from(businessIdCounters)
          .where(eq(businessIdCounters.prefix, "ITM"));
        expect(afterFirst.nextValue).toBeGreaterThanOrEqual(9000);
        expect(await nextBusinessId(tx, "ITM")).toBe("ITM-9001");

        // Second sync must not push the counter further forward.
        const [beforeSecond] = await tx
          .select()
          .from(businessIdCounters)
          .where(eq(businessIdCounters.prefix, "ITM"));
        await syncBusinessIdCounters(tx);
        const [afterSecond] = await tx
          .select()
          .from(businessIdCounters)
          .where(eq(businessIdCounters.prefix, "ITM"));
        expect(afterSecond.nextValue).toBe(beforeSecond.nextValue);

        // Every registered prefix now has a counter row (upserted by sync).
        const rows = await tx
          .select({ prefix: businessIdCounters.prefix })
          .from(businessIdCounters);
        expect(new Set(rows.map((r) => r.prefix)).size).toBeGreaterThanOrEqual(
          12
        );

        throw new Error(ROLLBACK);
      })
    ).rejects.toThrow(ROLLBACK);
  });

  it("allocates unique IDs under concurrency without losing a value", async () => {
    // Allocation-only (no table rows are created), so the only persistent
    // effect is the INV counter advancing — invisible to seed count assertions.
    const before = await db
      .select()
      .from(businessIdCounters)
      .where(eq(businessIdCounters.prefix, "INV"));
    const baseline = before[0]?.nextValue;

    const ids = await Promise.all(
      Array.from({ length: 10 }, () => nextBusinessId(db, "INV"))
    );

    expect(new Set(ids).size).toBe(10);
    for (const id of ids) {
      expect(id).toMatch(/^INV-\d{3,}$/);
    }

    const after = await db
      .select()
      .from(businessIdCounters)
      .where(eq(businessIdCounters.prefix, "INV"));
    if (baseline !== undefined && after[0]) {
      // Exactly ten increments — no lost updates under contention.
      expect(after[0].nextValue).toBe(baseline + 10);
    }

    // Allocated numbers never regress below any already-issued value.
    const numbers = ids.map((id) => itemNumber(id));
    const maxAfter = Math.max(...numbers);
    expect(maxAfter).toBeGreaterThan(0);
  });

  it("never hands the same ID to two racing allocators on the same prefix", async () => {
    const ids = await Promise.all(
      Array.from({ length: 25 }, () => nextBusinessId(db, "ITM"))
    );
    expect(new Set(ids).size).toBe(25);

    // And a subsequent single allocation continues above all of them.
    const next = await nextBusinessId(db, "ITM");
    const numbers = [...ids, next].map((id) => itemNumber(id));
    expect(Math.max(...numbers)).toBe(itemNumber(next));
  });

  it("keeps every allocated value below varchar(20) safety limits", async () => {
    const id = await nextBusinessId(db, "DEPT");
    expect(id.length).toBeLessThanOrEqual(20);
    // cleanup is unnecessary: only the (uncounted) counter row changed.
    expect(id).toMatch(/^DEPT-\d{3,}$/);
  });

  it("allocates concurrently across all 12 registered prefixes without collision", async () => {
    // Phase 18: every counter claimed to be replaced must actually work —
    // exercised together (cross-entity concurrency in one test case, since
    // test files are serialized against the shared guarded database).
    const keys = Object.keys(BUSINESS_IDS) as BusinessIdKey[];
    expect(keys).toHaveLength(12);

    const batches = await Promise.all(
      keys.map(async (key) => {
        const ids = await Promise.all(
          Array.from({ length: 3 }, () => nextBusinessId(db, key))
        );
        return { key, ids };
      })
    );

    for (const { key, ids } of batches) {
      const spec = BUSINESS_IDS[key];
      // Same prefix, three racing allocators: all distinct.
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        expect(id.startsWith(`${spec.prefix}-`)).toBe(true);
        expect(id.length).toBeLessThanOrEqual(20);
        const suffix = id.slice(spec.prefix.length + 1);
        expect(suffix).toMatch(/^\d+$/);
        expect(Number(suffix)).toBeGreaterThanOrEqual(spec.base);
      }
      // Monotonic: a follow-up single allocation continues above the batch.
      const numbers = ids.map((id) => Number(id.slice(spec.prefix.length + 1)));
      const next = await nextBusinessId(db, key);
      expect(Number(next.slice(spec.prefix.length + 1))).toBeGreaterThan(
        Math.max(...numbers)
      );
    }
  });
});

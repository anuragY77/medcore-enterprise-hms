import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isUniqueViolation } from "@/lib/billing";
import {
  applyMigrations,
  integrationEnabled,
  setupIntegration,
  teardownIntegration,
  type IntegrationContext,
} from "./helpers";

const RUN = integrationEnabled;
const SIMULATED_ERROR = "simulated failure inside transaction";

describe("integration gating", () => {
  it(
    RUN
      ? "TEST_DATABASE_URL is set — guarded integration suite enabled"
      : "TEST_DATABASE_URL not set — integration suite skipped (unit tests only)",
    () => {
      expect(typeof RUN).toBe("boolean");
    }
  );
});

describe.skipIf(!RUN)("database integration", () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await setupIntegration();
  });
  afterAll(async () => {
    await teardownIntegration(ctx);
  });

  it("applies committed migrations producing the core tables", async () => {
    const { rows } = await ctx.pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('users','patients','medical_records','invoices','audit_logs')`
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([
      "audit_logs",
      "invoices",
      "medical_records",
      "patients",
      "users",
    ]);
    const { rows: all } = await ctx.pool.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    expect(all[0].n).toBeGreaterThanOrEqual(22);
  });

  it("runs migrations idempotently (second run exits cleanly)", () => {
    expect(() => applyMigrations(ctx.url)).not.toThrow();
  });

  it("raises a 23505 unique violation recognized by isUniqueViolation", async () => {
    const email = `vitest-dup-${randomUUID()}@medcore.test`;
    const insert =
      `INSERT INTO users (email, password, name, role, department)
       VALUES ($1, 'x', 'Vitest Dup', 'DOCTOR', 'Internal')`;
    await ctx.pool.query(insert, [email]);
    try {
      await ctx.pool.query(insert, [email]);
      expect.unreachable("duplicate insert should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("23505");
      expect(isUniqueViolation(error)).toBe(true);
    } finally {
      await ctx.pool.query("DELETE FROM users WHERE email = $1", [email]);
    }
  });

  it("cascades medical_records deletion when the patient is deleted", async () => {
    const patientId = randomUUID();
    const patientCode = `VT-${randomUUID().replace(/-/g, "").slice(0, 17)}`;
    const { rows } = await ctx.pool.query(
      `INSERT INTO patients
         (id, patient_id, first_name, last_name, date_of_birth, gender,
          phone, department, attending_doctor)
       VALUES ($1, $2, 'Vitest', 'Cascade', '1990-01-01', 'Other',
          '555-0000', 'Internal', 'Dr. Test')
       RETURNING id`,
      [patientId, patientCode]
    );
    expect(rows).toHaveLength(1);
    try {
      await ctx.pool.query(
        `INSERT INTO medical_records (patient_id, record_type, title, recorded_by)
         VALUES ($1, 'Note', 'Vitest record', 'Vitest')`,
        [patientId]
      );
      const before = await ctx.pool.query(
        "SELECT count(*)::int AS n FROM medical_records WHERE patient_id = $1",
        [patientId]
      );
      expect(before.rows[0].n).toBe(1);

      await ctx.pool.query("DELETE FROM patients WHERE id = $1", [patientId]);

      const after = await ctx.pool.query(
        "SELECT count(*)::int AS n FROM medical_records WHERE patient_id = $1",
        [patientId]
      );
      expect(after.rows[0].n).toBe(0);
    } finally {
      await ctx.pool.query("DELETE FROM patients WHERE id = $1", [patientId]);
    }
  });

  it("rolls back every statement when a transaction fails", async () => {
    const patientId = randomUUID();
    const marker = `VT-${randomUUID().replace(/-/g, "").slice(0, 17)}`;
    const client = await ctx.pool.connect();
    let caught: unknown;
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO patients
           (id, patient_id, first_name, last_name, date_of_birth, gender,
            phone, department, attending_doctor)
         VALUES ($1, $2, 'Vitest', 'Rollback', '1990-01-01', 'Other',
            '555-0001', 'Internal', 'Dr. Test')`,
        [patientId, marker]
      );
      // Prove the row is visible INSIDE the transaction; otherwise a broken
      // insert would silently "pass" the rollback assertion below.
      const seen = await client.query(
        "SELECT count(*)::int AS n FROM patients WHERE patient_id = $1",
        [marker]
      );
      expect(seen.rows[0].n).toBe(1);
      throw new Error(SIMULATED_ERROR);
    } catch (error) {
      await client.query("ROLLBACK");
      caught = error;
    } finally {
      client.release();
    }
    // Only the deliberately injected failure may be swallowed; a failed insert
    // or a failed in-transaction assertion must surface as a real test error.
    if (!(caught instanceof Error && caught.message === SIMULATED_ERROR)) {
      throw caught instanceof Error
        ? caught
        : new Error("transaction test failed without a catchable error");
    }
    const { rows } = await ctx.pool.query(
      "SELECT count(*)::int AS n FROM patients WHERE patient_id = $1",
      [marker]
    );
    // Scoped cleanup: only this test's marker row.
    await ctx.pool.query("DELETE FROM patients WHERE patient_id = $1", [
      marker,
    ]);
    expect(rows[0].n).toBe(0);
  });
});

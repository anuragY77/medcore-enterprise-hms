import { describe, expect, it } from "vitest";
import {
  assertSeedTarget,
  parseSeedTarget,
  SeedGuardError,
} from "@/lib/db/seed/guard";
import { createRng, deterministicUuid } from "@/lib/db/seed/ids";
import { buildBedRows, buildPatientPlans } from "@/lib/db/seed/core";
import { DEMO_USERS, STAFF_SEED } from "@/lib/db/seed/datasets";

const OK_URL = "postgresql://postgres:secret@localhost:5432/medcore";

describe("seed guard", () => {
  it("accepts a loopback dev database with confirmation", () => {
    const target = assertSeedTarget({
      databaseUrl: OK_URL,
      nodeName: "development",
      confirmed: true,
    });
    expect(target).toEqual({ host: "localhost", database: "medcore" });
  });

  it("accepts the *_test database under NODE_ENV=test", () => {
    const target = assertSeedTarget({
      databaseUrl: "postgresql://postgres:secret@127.0.0.1:5432/medcore_test",
      nodeName: "test",
      confirmed: true,
    });
    expect(target.database).toBe("medcore_test");
  });

  it("refuses a missing database URL", () => {
    expect(() =>
      assertSeedTarget({ databaseUrl: undefined, nodeName: "development", confirmed: true })
    ).toThrow(SeedGuardError);
    expect(() =>
      assertSeedTarget({ databaseUrl: "   ", nodeName: "development", confirmed: true })
    ).toThrow(SeedGuardError);
  });

  it("refuses an unparseable URL (fails closed)", () => {
    expect(() =>
      assertSeedTarget({ databaseUrl: "not a url", nodeName: "development", confirmed: true })
    ).toThrow(/not parseable/);
  });

  it("refuses non-postgres schemes", () => {
    expect(() =>
      assertSeedTarget({
        databaseUrl: "mysql://root@localhost/medcore",
        nodeName: "development",
        confirmed: true,
      })
    ).toThrow(/unsupported scheme/);
  });

  it("refuses non-loopback hosts", () => {
    for (const url of [
      "postgresql://postgres:pw@db.example.com:5432/medcore",
      "postgresql://postgres:pw@10.0.0.5:5432/medcore",
      "postgresql://postgres:pw@192.168.1.20:5432/medcore",
    ]) {
      expect(() =>
        assertSeedTarget({ databaseUrl: url, nodeName: "development", confirmed: true })
      ).toThrow(/not loopback/);
    }
  });

  it("normalizes host case but still refuses lookalike loopback hosts", () => {
    // postgres: is a non-special URL scheme, so the URL parser keeps host
    // case as written. Case variants of loopback literals are the same host
    // and must be accepted after normalization; opaque-host spellings that
    // merely look like loopback must still fail closed.
    for (const url of [
      "PostgreSQL://LOCALHOST:5432/medcore",
      "postgres://LocalHost/medcore",
      "postgresql://postgres:pw@[::1]:5432/medcore",
    ]) {
      expect(() =>
        assertSeedTarget({ databaseUrl: url, nodeName: "development", confirmed: true })
      ).not.toThrow();
    }
    for (const url of [
      "postgresql://postgres:pw@local%68ost:5432/medcore",
      "postgresql://postgres:pw@localhost.:5432/medcore",
      "postgresql://postgres:pw@127.1:5432/medcore",
      "postgresql://postgres:pw@2130706433:5432/medcore",
      "postgresql://postgres:pw@0x7f000001:5432/medcore",
      "postgresql://postgres:pw@0:5432/medcore",
      "jdbc:postgresql://localhost:5432/medcore",
    ]) {
      expect(() =>
        assertSeedTarget({ databaseUrl: url, nodeName: "development", confirmed: true })
      ).toThrow(SeedGuardError);
    }
  });

  it("refuses production-like database names", () => {
    for (const name of ["hms_prod", "hospital_production", "staging_hms", "client_live", "uat_data"]) {
      expect(() =>
        assertSeedTarget({
          databaseUrl: `postgresql://postgres:pw@localhost:5432/${name}`,
          nodeName: "development",
          confirmed: true,
        })
      ).toThrow(/production-like/);
    }
  });

  it("refuses production or missing NODE_ENV", () => {
    for (const env of ["production", undefined, ""]) {
      expect(() =>
        assertSeedTarget({ databaseUrl: OK_URL, nodeName: env, confirmed: true })
      ).toThrow(/NODE_ENV/);
    }
  });

  it("refuses to run without explicit confirmation", () => {
    expect(() =>
      assertSeedTarget({ databaseUrl: OK_URL, nodeName: "development", confirmed: false })
    ).toThrow(/confirmation/);
  });

  it("parseSeedTarget never touches process.env", () => {
    expect(() => parseSeedTarget(undefined)).toThrow(SeedGuardError);
  });
});

describe("deterministic identifiers", () => {
  it("produces stable, well-formed UUIDs", () => {
    const a = deterministicUuid("patient", "PT-10482");
    const b = deterministicUuid("patient", "PT-10482");
    const c = deterministicUuid("patient", "PT-10483");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("keeps the PRNG repeatable", () => {
    const r1 = createRng(42);
    const r2 = createRng(42);
    const s1 = [r1(), r1(), r1()];
    const s2 = [r2(), r2(), r2()];
    expect(s1).toEqual(s2);
    expect(createRng(43)()).not.toBe(createRng(42)());
  });
});

describe("demo dataset shape", () => {
  const now = new Date("2026-10-04T12:00:00");

  it("brands the demo administrator as Anurag Yadav", () => {
    const admin = DEMO_USERS.find((u) => u.role === "ADMIN");
    expect(admin?.name).toBe("Anurag Yadav");
    expect(admin?.email).toBe("admin@medcore.com");
  });

  it("builds 80 patients: 68 Indian + 12 international, role split as specified", () => {
    const plans = buildPatientPlans(createRng(0xc0ffee), now);
    expect(plans).toHaveLength(80);

    const international = plans.filter((p) => !p.phone.startsWith("+91"));
    expect(international).toHaveLength(12);

    const critical = plans.filter((p) => p.status === "Critical");
    const discharged = plans.filter((p) => p.status === "Discharged");
    const admittedActive = plans.filter(
      (p) => p.status === "Active" && p.admitted && !p.discharged
    );
    const outpatients = plans.filter((p) => !p.admitted);
    expect(critical).toHaveLength(6);
    expect(admittedActive).toHaveLength(28);
    expect(discharged).toHaveLength(14);
    expect(outpatients).toHaveLength(32);
    for (const p of critical) expect(p.department).toBe("ICU");

    // Stable, contiguous, unique patient numbers (count-based compatibility).
    const ids = plans.map((p) => p.patientId);
    expect(new Set(ids).size).toBe(80);
    expect(ids[0]).toBe("PT-10482");
    expect(ids[79]).toBe("PT-10561");

    // Attending doctors come from the staff doctor roster.
    const doctorNames = new Set(
      STAFF_SEED.filter((s) => s.role === "Doctor").map(
        (s) => `Dr. ${s.firstName} ${s.lastName}`
      )
    );
    for (const p of plans) expect(doctorNames.has(p.attendingDoctor)).toBe(true);

    // Insurance fields always travel together.
    for (const p of plans) {
      expect(Boolean(p.insuranceProvider) === Boolean(p.insured)).toBe(true);
      expect(Boolean(p.insurancePolicyNumber) === Boolean(p.insured)).toBe(true);
    }
  });

  it("builds 94 uniquely-numbered beds across admitting departments", () => {
    const beds = buildBedRows();
    expect(beds).toHaveLength(94);
    expect(new Set(beds.map((b) => b.bedId)).size).toBe(94);
    expect(beds.every((b) => b.roomNumber.length > 0)).toBe(true);
    expect(new Set(beds.map((b) => b.roomNumber)).size).toBe(94);
  });
});

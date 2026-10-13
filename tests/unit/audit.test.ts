// Phase 32: audit-write semantics.
//
// insertAuditRow is the transactional primitive — it THROWS on failure so a
// clinical transaction can roll back with it. recordAudit is the best-effort
// wrapper for contexts with no clinical transaction (login outcomes, simple
// creates): it never throws, but it increments an in-process failure counter
// and logs a structured, PHI-free line so repeated failures stay observable
// (surfaced by GET /api/health to security:read sessions).
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  insertValues: [] as Record<string, unknown>[],
  failNext: false,
}));

vi.mock("@/lib/db", () => {
  const insert = () => ({
    values: (values: Record<string, unknown>) => {
      dbCtl.insertValues.push(values);
      return {
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown
        ) => {
          if (dbCtl.failNext) {
            dbCtl.failNext = false;
            return Promise.reject(new Error("injected audit failure")).then(
              resolve,
              reject
            );
          }
          return Promise.resolve([{ id: "audit-row" }]).then(resolve, reject);
        },
      };
    },
  });
  return { db: { insert }, auditLogs: "audit_logs" };
});

import {
  insertAuditRow,
  recordAudit,
  getAuditFailureCount,
  resetAuditFailureCountForTests,
} from "@/lib/audit";

const event = {
  actorId: "11111111-1111-1111-1111-111111111111",
  action: "patient.create",
  entityType: "patient",
  entityId: "22222222-2222-2222-2222-222222222222",
  severity: "INFO",
  category: "patients",
  success: true,
  metadata: { patientNumber: "PT-900001" },
};

beforeEach(() => {
  dbCtl.insertValues.length = 0;
  dbCtl.failNext = false;
  resetAuditFailureCountForTests();
  vi.restoreAllMocks();
});

describe("insertAuditRow", () => {
  it("forwards every event field to the executor insert", async () => {
    const fakeTx = { insert: () => ({ values: (v: Record<string, unknown>) => {
      dbCtl.insertValues.push(v);
      return Promise.resolve([]);
    } }) };

    await insertAuditRow(
      fakeTx as unknown as Parameters<typeof insertAuditRow>[0],
      event
    );

    expect(dbCtl.insertValues).toHaveLength(1);
    expect(dbCtl.insertValues[0]).toMatchObject({
      actorId: event.actorId,
      action: "patient.create",
      entityType: "patient",
      entityId: event.entityId,
      severity: "INFO",
      category: "patients",
      success: true,
      metadata: { patientNumber: "PT-900001" },
    });
  });

  it("THROWS when the executor fails (so a clinical tx can roll back)", async () => {
    dbCtl.failNext = true;
    const fakeTx = { insert: () => ({ values: () => ({
      then: (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown
      ) =>
        Promise.reject(new Error("injected audit failure")).then(
          resolve,
          reject
        ),
    }) }) };

    await expect(
      insertAuditRow(
        fakeTx as unknown as Parameters<typeof insertAuditRow>[0],
        event
      )
    ).rejects.toThrow("injected audit failure");
  });
});

describe("recordAudit (best-effort)", () => {
  it("never throws and writes the row on success", async () => {
    await expect(recordAudit(event)).resolves.toBeUndefined();
    expect(dbCtl.insertValues).toHaveLength(1);
    expect(getAuditFailureCount()).toBe(0);
  });

  it("never throws on failure, increments the failure counter, logs action without metadata values", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    dbCtl.failNext = true;

    await expect(recordAudit(event)).resolves.toBeUndefined();

    expect(getAuditFailureCount()).toBe(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(errorSpy.mock.calls[0]);
    expect(logged).toContain("patient.create");
    // The log line names the action/entityType only — never metadata values.
    expect(logged).not.toContain("PT-900001");
  });

  it("accumulates the counter across repeated failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbCtl.failNext = true;
    await recordAudit(event);
    dbCtl.failNext = true;
    await recordAudit(event);
    expect(getAuditFailureCount()).toBe(2);
  });

  it("resetAuditFailureCountForTests restores a zero baseline", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbCtl.failNext = true;
    await recordAudit(event);
    expect(getAuditFailureCount()).toBe(1);
    resetAuditFailureCountForTests();
    expect(getAuditFailureCount()).toBe(0);
  });
});

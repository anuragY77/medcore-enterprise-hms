// Phase 32: audit reliability & clinical lifecycle integration tests.
//
// 1. Atomic-audit fault injection: when the in-transaction audit insert
//    fails, the clinical mutation MUST roll back — no partial dispense,
//    no partial lab completion, no success audit residue. The next attempt
//    (audit healthy again) succeeds and writes exactly one audit row.
// 2. Database-level proof: insertAuditRow with a foreign-key-violating
//    actor inside a real transaction rolls the whole transaction back.
// 3. Patient-delete lifecycle: hard delete cascades clinical children
//    (prescriptions, lab tests), releases held beds, and the
//    patient.delete / bed.release audit rows SURVIVE the deletion (the
//    audit trail keeps the action history even though the entity is gone).
//
// All fixtures are synthetic; the guarded *_test database is used throughout.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  integrationEnabled,
  setupIntegration,
  teardownIntegration,
  type IntegrationContext,
} from "./helpers";

const RUN = integrationEnabled;

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

// The factory defers importOriginal until a consumer first imports the mocked
// module — which happens inside beforeAll AFTER process.env.DATABASE_URL is
// repointed at the test database (a top-level import would bind @/lib/db to
// the setup.ts placeholder URL instead).
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    insertAuditRow: vi.fn(actual.insertAuditRow),
    recordAudit: vi.fn(actual.recordAudit),
  };
});

import { auth } from "@/lib/auth";

const authMock = vi.mocked(auth);
type InsertAuditRow = typeof import("@/lib/audit").insertAuditRow;
let insertAuditRowMock: ReturnType<typeof vi.fn<InsertAuditRow>>;

type TestSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
  };
  sessionId: string;
  authAt: number;
};

type RouteHandler = (
  request: import("next/server").NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

type Routes = {
  dispense: RouteHandler;
  completeLab: RouteHandler;
  deletePatient: RouteHandler;
};

let ctx: IntegrationContext;
let actorId: string;
let routes: Routes;
const createdPatients: string[] = [];
const createdBeds: string[] = [];
const createdUsers: string[] = [];
const createdMedicines: string[] = [];

function session(): TestSession {
  return {
    user: {
      id: actorId,
      name: "Audit Reliability Tester",
      email: "audit-rel@medcore.test",
      role: "ADMIN",
      department: "Administration",
    },
    sessionId: "sid-audit-rel",
    authAt: 1_700_000_000,
  };
}

async function post(
  handler: RouteHandler,
  apiPath: string,
  id: string,
  body: unknown
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(
    `http://localhost:3000/api/${apiPath}/${id}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      duplex: "half" as const,
    } as ConstructorParameters<typeof import("next/server").NextRequest>[1]
  );
  return handler(request, { params: Promise.resolve({ id }) });
}

async function del(
  handler: RouteHandler,
  apiPath: string,
  id: string
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(
    `http://localhost:3000/api/${apiPath}/${id}`,
    { method: "DELETE" }
  );
  return handler(request, { params: Promise.resolve({ id }) });
}

async function createPatient(): Promise<string> {
  const id = randomUUID();
  const patientCode = `PT-AR-${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await ctx.pool.query(
    `INSERT INTO patients
       (id, patient_id, first_name, last_name, date_of_birth, gender,
        phone, department, attending_doctor, status)
     VALUES ($1, $2, 'AuditRel', 'Fixture', '1990-01-01', 'Other',
        '555-0000', 'Cardiology', 'Dr. Fixture', 'Active')`,
    [id, patientCode]
  );
  createdPatients.push(id);
  return id;
}

async function createLabTest(patientId: string): Promise<string> {
  const id = randomUUID();
  const testCode = `LAB-AR-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await ctx.pool.query(
    `INSERT INTO lab_tests (id, test_id, patient_id, test_name, category, status, test_date)
     VALUES ($1, $2, $3, 'AuditRel CBC', 'Hematology', 'Pending', NOW())`,
    [id, testCode, patientId]
  );
  return id;
}

async function createMedicineAndPrescription(patientId: string) {
  const medId = randomUUID();
  const medCode = `MED-AR-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const medName = "AuditRel Drug " + randomUUID().slice(0, 8);
  await ctx.pool.query(
    `INSERT INTO pharmacy_medicines
       (id, medicine_id, name, generic_name, category, dosage,
        unit, stock_quantity, expiry_date, unit_price, status)
     VALUES ($1, $2, $3, 'auditrel', 'Analgesic', '500mg',
        'box', 5, NOW() + interval '1 year', 4.5, 'Active')`,
    [medId, medCode, medName]
  );
  createdMedicines.push(medId);
  const rxId = randomUUID();
  await ctx.pool.query(
    `INSERT INTO prescriptions
       (id, patient_id, medication_name, dosage, frequency, prescribed_by, status)
     VALUES ($1, $2, $3, '500mg', 'twice daily', 'Dr. Fixture', 'Active')`,
    [rxId, patientId, medName]
  );
  return { rxId, medId, medName };
}

async function createOccupiedBed(patientId: string): Promise<string> {
  const id = randomUUID();
  const bedCode = `BED-AR-${randomUUID().replace(/-/g, "").slice(0, 13)}`;
  await ctx.pool.query(
    `INSERT INTO beds (id, bed_id, room_number, department, type, status, patient_id)
     VALUES ($1, $2, 'AR-1', 'Cardiology', 'General', 'Occupied', $3)`,
    [id, bedCode, patientId]
  );
  createdBeds.push(id);
  return id;
}

async function rxStatus(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT status FROM prescriptions WHERE id = $1",
    [id]
  );
  return rows[0]?.status as string | undefined;
}

async function labStatus(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT status FROM lab_tests WHERE id = $1",
    [id]
  );
  return rows[0]?.status as string | undefined;
}

async function auditCount(action: string, entityId: string) {
  const { rows } = await ctx.pool.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE action = $1 AND entity_id = $2",
    [action, entityId]
  );
  return rows[0].n as number;
}

beforeAll(async () => {
  if (!RUN) return;
  ctx = await setupIntegration();
  process.env.DATABASE_URL = ctx.url;
  const { rows } = await ctx.pool.query(
    `INSERT INTO users (email, password, name, role, department)
     VALUES ($1, 'x', 'Audit Reliability Tester', 'ADMIN', 'Administration')
     RETURNING id`,
    [`audit-rel-${Date.now()}@medcore.test`]
  );
  actorId = rows[0].id as string;
  createdUsers.push(actorId);
  // Import the mocked audit module now that DATABASE_URL points at the test DB.
  const audit = await import("@/lib/audit");
  insertAuditRowMock = vi.mocked(audit.insertAuditRow);
  const [dispenseModule, completeModule, deleteModule] = await Promise.all([
    import("@/app/api/pharmacy/prescriptions/[id]/dispense/route"),
    import("@/app/api/laboratory/[id]/complete/route"),
    import("@/app/api/patients/[id]/route"),
  ]);
  routes = {
    dispense: dispenseModule.POST,
    completeLab: completeModule.POST,
    deletePatient: deleteModule.DELETE,
  };
});

afterAll(async () => {
  if (!ctx) return;
  if (actorId) {
    await ctx.pool.query("DELETE FROM audit_logs WHERE actor_id = $1", [actorId]);
  }
  if (createdBeds.length > 0) {
    await ctx.pool.query("DELETE FROM beds WHERE id = ANY($1::uuid[])", [createdBeds]);
  }
  if (createdMedicines.length > 0) {
    await ctx.pool.query(
      "DELETE FROM pharmacy_medicines WHERE id = ANY($1::uuid[])",
      [createdMedicines]
    );
  }
  if (createdPatients.length > 0) {
    await ctx.pool.query(
      "DELETE FROM patients WHERE id = ANY($1::uuid[])",
      [createdPatients]
    );
  }
  if (createdUsers.length > 0) {
    await ctx.pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
      createdUsers,
    ]);
  }
  await teardownIntegration(ctx);
});

beforeEach(() => {
  if (!RUN) return;
  authMock.mockReturnValue(
    session() as unknown as Awaited<ReturnType<typeof auth>>
  );
  // Restore the delegating default (tests override with mockRejectedValueOnce).
  insertAuditRowMock.mockImplementation(async (exec, event) => {
    const actual = await vi.importActual<typeof import("@/lib/audit")>(
      "@/lib/audit"
    );
    return actual.insertAuditRow(exec, event);
  });
});

describe("atomic audit — dispense", () => {
  it("rolls back the dispense when the in-tx audit insert fails; retry succeeds with exactly one audit row", async () => {
    if (!RUN) return;
    const patientId = await createPatient();
    const { rxId } = await createMedicineAndPrescription(patientId);

    insertAuditRowMock.mockRejectedValueOnce(
      new Error("injected audit failure")
    );

    const failed = await post(routes.dispense, "pharmacy/prescriptions", rxId, {
      quantity: 2,
    });
    expect(failed.status).toBe(500);

    // Clinical state untouched by the rolled-back transaction.
    expect(await rxStatus(rxId)).toBe("Active");
    expect(await auditCount("pharmacy.dispense", rxId)).toBe(0);

    // Healthy retry: dispense commits WITH its audit row.
    const ok = await post(routes.dispense, "pharmacy/prescriptions", rxId, {
      quantity: 2,
    });
    expect(ok.status).toBe(201);
    expect(await rxStatus(rxId)).toBe("Completed");
    expect(await auditCount("pharmacy.dispense", rxId)).toBe(1);
  });
});

describe("atomic audit — lab complete", () => {
  it("rolls back the completion (and its medical record) when the audit insert fails", async () => {
    if (!RUN) return;
    const patientId = await createPatient();
    const labId = await createLabTest(patientId);

    insertAuditRowMock.mockRejectedValueOnce(
      new Error("injected audit failure")
    );

    const failed = await post(routes.completeLab, "laboratory", labId, {
      result: "Hb 13.2 g/dL",
    });
    expect(failed.status).toBe(500);
    expect(await labStatus(labId)).toBe("Pending");
    const { rows: records } = await ctx.pool.query(
      "SELECT count(*)::int AS n FROM medical_records WHERE patient_id = $1 AND record_type = 'Lab'",
      [patientId]
    );
    expect(records[0].n).toBe(0);
    expect(await auditCount("laboratory.test.complete", labId)).toBe(0);

    const ok = await post(routes.completeLab, "laboratory", labId, {
      result: "Hb 13.2 g/dL",
    });
    expect(ok.status).toBe(201);
    expect(await labStatus(labId)).toBe("Completed");
    expect(await auditCount("laboratory.test.complete", labId)).toBe(1);
  });
});

describe("database-level atomicity primitive", () => {
  it("insertAuditRow with a foreign-key-violating actor rolls back the enclosing transaction", async () => {
    if (!RUN) return;
    const { db } = await import("@/lib/db");
    const { patients } = await import("@/lib/db/schema");
    const patientId = randomUUID();

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(patients).values({
          id: patientId,
          patientId: `PT-FK-${randomUUID().replace(/-/g, "").slice(0, 14)}`,
          firstName: "FkRollback",
          lastName: "Fixture",
          dateOfBirth: new Date("1990-01-01"),
          gender: "Other",
          phone: "555-0000",
          department: "Cardiology",
          attendingDoctor: "Dr. Fixture",
          status: "Active",
        });
        // Real insertAuditRow (delegated by the mock) against a nonexistent actor.
        await insertAuditRowMock(tx, {
          actorId: randomUUID(),
          action: "fk.rollback.probe",
          entityType: "patient",
          entityId: patientId,
        });
      })
    ).rejects.toThrow();

    const { rows } = await ctx.pool.query(
      "SELECT count(*)::int AS n FROM patients WHERE id = $1",
      [patientId]
    );
    expect(rows[0].n).toBe(0);
  });
});

describe("patient delete lifecycle", () => {
  it("cascades clinical children, releases the bed, and the audit trail survives", async () => {
    if (!RUN) return;
    const patientId = await createPatient();
    const { rxId } = await createMedicineAndPrescription(patientId);
    const labId = await createLabTest(patientId);
    const bedId = await createOccupiedBed(patientId);

    const res = await del(routes.deletePatient, "patients", patientId);
    expect(res.status).toBe(200);

    // Patient and clinical children gone (hard delete, documented cascade).
    const { rows: p } = await ctx.pool.query(
      "SELECT count(*)::int AS n FROM patients WHERE id = $1",
      [patientId]
    );
    expect(p[0].n).toBe(0);
    expect(await rxStatus(rxId)).toBeUndefined();
    expect(await labStatus(labId)).toBeUndefined();

    // Bed released, not orphaned.
    const { rows: b } = await ctx.pool.query(
      "SELECT status, patient_id FROM beds WHERE id = $1",
      [bedId]
    );
    expect(b[0].status).toBe("Available");
    expect(b[0].patient_id).toBeNull();

    // Audit history SURVIVES the deletion (entity_id has no FK): the trail
    // still shows who deleted the patient and which bed was released.
    expect(await auditCount("patient.delete", patientId)).toBe(1);
    expect(await auditCount("bed.release", bedId)).toBe(1);
  });
});

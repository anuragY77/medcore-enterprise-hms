// Phase 32: audit reliability & clinical lifecycle integration tests.
// Phase 33: extended to financial/destructive mutations converted to
// same-transaction audit (invoice update/delete, claim update, user
// delete, occupied-bed create) — fault-injection proves a failed audit
// insert rolls the mutation back and a clean retry commits both.
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
// 4. Financial atomicity: invoice update/delete and claim update roll
//    back when the audit insert fails; retry commits with exactly one
//    audit row each.
// 5. Destructive-delete atomicity: user delete rolls back when the audit
//    insert fails; retry removes the user with one audit row.
// 6. Occupied-bed-create atomicity: a failed audit insert leaves no bed
//    and no occupancy; retry creates the bed with one bed.assign audit.
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
  updateInvoice: RouteHandler;
  deleteInvoice: RouteHandler;
  updateClaim: RouteHandler;
  deleteUser: RouteHandler;
  createBed: (request: import("next/server").NextRequest) => Promise<Response>;
};

let ctx: IntegrationContext;
let actorId: string;
let routes: Routes;
const createdPatients: string[] = [];
const createdBeds: string[] = [];
const createdUsers: string[] = [];
const createdMedicines: string[] = [];
const createdInvoices: string[] = [];
const createdClaims: string[] = [];

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

async function put(
  handler: RouteHandler,
  apiPath: string,
  id: string,
  body: unknown
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(
    `http://localhost:3000/api/${apiPath}/${id}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      duplex: "half" as const,
    } as ConstructorParameters<typeof import("next/server").NextRequest>[1]
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

async function createInvoice(patientId: string): Promise<{ id: string; total: number }> {
  const id = randomUUID();
  const invoiceCode = `INV-AR-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await ctx.pool.query(
    `INSERT INTO invoices (id, invoice_id, patient_id, subtotal, total_amount, status)
     VALUES ($1, $2, $3, 100, 100, 'Pending')`,
    [id, invoiceCode, patientId]
  );
  createdInvoices.push(id);
  return { id, total: 100 };
}

async function createClaim(patientId: string): Promise<string> {
  const id = randomUUID();
  const claimCode = `CLM-AR-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await ctx.pool.query(
    `INSERT INTO insurance_claims
       (id, claim_id, patient_id, provider_name, policy_number, claim_amount, status)
     VALUES ($1, $2, $3, 'AR Insurer', 'POL-AR', 50, 'Submitted')`,
    [id, claimCode, patientId]
  );
  createdClaims.push(id);
  return id;
}

async function createTargetUser(): Promise<string> {
  const { rows } = await ctx.pool.query(
    `INSERT INTO users (email, password, name, role, department)
     VALUES ($1, 'x', 'AR Target User', 'NURSE', 'Cardiology') RETURNING id`,
    [`ar-target-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@medcore.test`]
  );
  const userId = rows[0].id as string;
  createdUsers.push(userId);
  return userId;
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

async function invoiceStatus(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT status FROM invoices WHERE id = $1",
    [id]
  );
  return rows[0]?.status as string | undefined;
}

async function claimStatus(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT status FROM insurance_claims WHERE id = $1",
    [id]
  );
  return rows[0]?.status as string | undefined;
}

async function userExists(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT count(*)::int AS n FROM users WHERE id = $1",
    [id]
  );
  return (rows[0].n as number) > 0;
}

async function bedForPatient(patientId: string) {
  const { rows } = await ctx.pool.query(
    "SELECT id FROM beds WHERE patient_id = $1 LIMIT 1",
    [patientId]
  );
  return rows[0]?.id as string | undefined;
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
  const [dispenseModule, completeModule, deleteModule, billingIdModule, insuranceIdModule, userIdModule, bedsModule] =
    await Promise.all([
      import("@/app/api/pharmacy/prescriptions/[id]/dispense/route"),
      import("@/app/api/laboratory/[id]/complete/route"),
      import("@/app/api/patients/[id]/route"),
      import("@/app/api/billing/[id]/route"),
      import("@/app/api/insurance/[id]/route"),
      import("@/app/api/users/[id]/route"),
      import("@/app/api/beds/route"),
    ]);
  routes = {
    dispense: dispenseModule.POST,
    completeLab: completeModule.POST,
    deletePatient: deleteModule.DELETE,
    updateInvoice: billingIdModule.PUT,
    deleteInvoice: billingIdModule.DELETE,
    updateClaim: insuranceIdModule.PUT,
    deleteUser: userIdModule.DELETE,
    createBed: bedsModule.POST,
  };
});

afterAll(async () => {
  if (!ctx) return;
  if (actorId) {
    await ctx.pool.query("DELETE FROM audit_logs WHERE actor_id = $1", [actorId]);
  }
  if (createdClaims.length > 0) {
    await ctx.pool.query(
      "DELETE FROM insurance_claims WHERE id = ANY($1::uuid[])",
      [createdClaims]
    );
  }
  if (createdInvoices.length > 0) {
    await ctx.pool.query(
      "DELETE FROM invoices WHERE id = ANY($1::uuid[])",
      [createdInvoices]
    );
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

  it("erases every CASCADE child table documented in the decision record and leaves notifications intact", async () => {
    if (!RUN) return;
    const patientId = await createPatient();

    // Seed one row in each of the 13 CASCADE child tables (decision record
    // section "Current behaviour" — patient record delete).
    await ctx.pool.query(
      `INSERT INTO patient_allergies (patient_id, allergy) VALUES ($1, 'Peanuts')`,
      [patientId]
    );
    await ctx.pool.query(
      `INSERT INTO patient_conditions (patient_id, condition) VALUES ($1, 'Asthma')`,
      [patientId]
    );
    await ctx.pool.query(
      `INSERT INTO patient_medications (patient_id, medication) VALUES ($1, 'Salbutamol')`,
      [patientId]
    );
    const { rows: consultRows } = await ctx.pool.query(
      `INSERT INTO consultations (patient_id, doctor_name, chief_complaint, diagnosis)
       VALUES ($1, 'Dr Test', 'Cough', 'Cold') RETURNING id`,
      [patientId]
    );
    await ctx.pool.query(
      `INSERT INTO prescriptions (patient_id, medication_name, dosage, frequency, prescribed_by)
       VALUES ($1, 'Amoxicillin', '500mg', '3x/day', 'Dr Test')`,
      [patientId]
    );
    await ctx.pool.query(
      `INSERT INTO medical_records (patient_id, record_type, title, recorded_by)
       VALUES ($1, 'Note', 'Intake note', 'Dr Test')`,
      [patientId]
    );
    await ctx.pool.query(
      `INSERT INTO vitals (patient_id, heart_rate, recorded_by) VALUES ($1, 72, 'Nurse Test')`,
      [patientId]
    );
    await ctx.pool.query(
      `INSERT INTO appointments (appointment_id, patient_id, doctor_name, department, date, time, type, status)
       VALUES ($1, $2, 'Dr Test', 'Cardiology', now(), '10:00', 'Consultation', 'Scheduled')`,
      [`AP-AR-${randomUUID().slice(0, 6)}`, patientId]
    );
    await ctx.pool.query(
      `INSERT INTO lab_tests (test_id, patient_id, test_name, category, status, test_date)
       VALUES ($1, $2, 'CBC', 'Hematology', 'Pending', now())`,
      [`LT-AR-${randomUUID().slice(0, 6)}`, patientId]
    );
    const { rows: invRows } = await ctx.pool.query(
      `INSERT INTO invoices (invoice_id, patient_id, subtotal, total_amount, status)
       VALUES ($1, $2, 100, 100, 'Pending') RETURNING id`,
      [`INV-AR-${randomUUID().slice(0, 6)}`, patientId]
    );
    await ctx.pool.query(
      `INSERT INTO insurance_claims (claim_id, patient_id, invoice_id, provider_name, policy_number, claim_amount, status)
       VALUES ($1, $2, $3, 'Insurer', 'POL', 50, 'Submitted')`,
      [`CLM-AR-${randomUUID().slice(0, 6)}`, patientId, invRows[0].id]
    );
    await ctx.pool.query(
      `INSERT INTO emergency_cases (case_id, patient_id, arrival_time, triage_level, status, chief_complaint)
       VALUES ($1, $2, now(), 2, 'Treated', 'Chest pain')`,
      [`EM-AR-${randomUUID().slice(0, 6)}`, patientId]
    );
    // Surgeries require a staff surgeon FK; reuse the actor's user id only if a
    // staff row exists — otherwise skip this one table (staff RESTRICT is
    // unrelated to the patient cascade being verified).
    const { rows: staffRows } = await ctx.pool.query(
      `INSERT INTO staff (staff_id, first_name, last_name, email, phone, role, department)
       VALUES ($1, 'AR', 'Surgeon', $2, '555-0000', 'Surgeon', 'Surgery') RETURNING id`,
      [`ST-AR-${randomUUID().slice(0, 6)}`, `ar-surgeon-${Date.now()}@medcore.test`]
    );
    await ctx.pool.query(
      `INSERT INTO surgeries (surgery_id, patient_id, surgeon_id, procedure_name, procedure_type, surgery_date, department, status)
       VALUES ($1, $2, $3, 'Appendectomy', 'Emergency', now(), 'Surgery', 'Scheduled')`,
      [`SG-AR-${randomUUID().slice(0, 6)}`, patientId, staffRows[0].id]
    );
    // Notifications reference a USER, not a patient — pre-create one to prove
    // patient deletion leaves it intact.
    const { rows: notifUserRows } = await ctx.pool.query(
      `INSERT INTO users (email, password, name, role, department)
       VALUES ($1, 'x', 'AR Notif User', 'NURSE', 'Cardiology') RETURNING id`,
      [`ar-notif-${Date.now()}@medcore.test`]
    );
    createdUsers.push(notifUserRows[0].id as string);
    const { rows: notifRows } = await ctx.pool.query(
      `INSERT INTO notifications (recipient_id, title, message)
       VALUES ($1, 'Hello', 'Unrelated notification') RETURNING id`,
      [notifUserRows[0].id]
    );

    const res = await del(routes.deletePatient, "patients", patientId);
    expect(res.status).toBe(200);

    // Every CASCADE child is erased (decision-record inventory).
    for (const table of [
      "patient_allergies",
      "patient_conditions",
      "patient_medications",
      "consultations",
      "prescriptions",
      "medical_records",
      "vitals",
      "appointments",
      "lab_tests",
      "invoices",
      "insurance_claims",
      "emergency_cases",
      "surgeries",
    ]) {
      const { rows } = await ctx.pool.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE patient_id = $1`,
        [patientId]
      );
      expect(
        (rows[0].n as number),
        `${table} rows should cascade-erase with the patient`
      ).toBe(0);
    }
    // Consultation was created, proving the FK path was exercised.
    expect(consultRows).toHaveLength(1);

    // Notifications are unaffected (no patient FK).
    const { rows: notifCheck } = await ctx.pool.query(
      `SELECT count(*)::int AS n FROM notifications WHERE id = $1`,
      [notifRows[0].id]
    );
    expect(notifCheck[0].n).toBe(1);

    // Audit trail survives with the delete recorded.
    expect(await auditCount("patient.delete", patientId)).toBe(1);

    // Cleanup the synthetic staff row so afterAll's user cleanup is enough.
    await ctx.pool.query(`DELETE FROM staff WHERE id = $1`, [staffRows[0].id]);
  });
});

describe("atomic audit — invoice update (financial)", () => {
  it("rolls back a paid-status flip when the audit insert fails; retry commits with one audit row", async () => {
    if (!RUN) return;
    const patientId = await createPatient();
    const { id: invoiceId, total } = await createInvoice(patientId);

    insertAuditRowMock.mockRejectedValueOnce(
      new Error("injected audit failure")
    );

    const failed = await put(routes.updateInvoice, "billing", invoiceId, {
      status: "Paid",
      paidAmount: total,
      paymentMethod: "Cash",
    });
    expect(failed.status).toBe(500);
    // Financial state untouched: the invoice is still Pending.
    expect(await invoiceStatus(invoiceId)).toBe("Pending");
    expect(await auditCount("billing.invoice.update", invoiceId)).toBe(0);

    const ok = await put(routes.updateInvoice, "billing", invoiceId, {
      status: "Paid",
      paidAmount: total,
      paymentMethod: "Cash",
    });
    expect(ok.status).toBe(200);
    expect(await invoiceStatus(invoiceId)).toBe("Paid");
    expect(await auditCount("billing.invoice.update", invoiceId)).toBe(1);
  });
});

describe("atomic audit — invoice delete (destructive financial)", () => {
  it("rolls back the delete when the audit insert fails; retry removes the invoice with one audit row", async () => {
    if (!RUN) return;
    const patientId = await createPatient();
    const { id: invoiceId } = await createInvoice(patientId);

    insertAuditRowMock.mockRejectedValueOnce(
      new Error("injected audit failure")
    );

    const failed = await del(routes.deleteInvoice, "billing", invoiceId);
    expect(failed.status).toBe(500);
    // The invoice still exists: the destructive delete rolled back with the audit.
    expect(await invoiceStatus(invoiceId)).toBe("Pending");
    expect(await auditCount("billing.invoice.delete", invoiceId)).toBe(0);

    const ok = await del(routes.deleteInvoice, "billing", invoiceId);
    expect(ok.status).toBe(200);
    expect(await invoiceStatus(invoiceId)).toBeUndefined();
    expect(await auditCount("billing.invoice.delete", invoiceId)).toBe(1);
  });
});

describe("atomic audit — insurance claim update (financial)", () => {
  it("rolls back an approval when the audit insert fails; retry commits with one audit row", async () => {
    if (!RUN) return;
    const patientId = await createPatient();
    const claimId = await createClaim(patientId);

    insertAuditRowMock.mockRejectedValueOnce(
      new Error("injected audit failure")
    );

    const failed = await put(routes.updateClaim, "insurance", claimId, {
      status: "Approved",
      approvedAmount: 50,
    });
    expect(failed.status).toBe(500);
    // Claim still Submitted: the approval rolled back with the audit.
    expect(await claimStatus(claimId)).toBe("Submitted");
    expect(await auditCount("insurance.claim.update", claimId)).toBe(0);

    const ok = await put(routes.updateClaim, "insurance", claimId, {
      status: "Approved",
      approvedAmount: 50,
    });
    expect(ok.status).toBe(200);
    expect(await claimStatus(claimId)).toBe("Approved");
    expect(await auditCount("insurance.claim.update", claimId)).toBe(1);
  });
});

describe("atomic audit — user delete (destructive security)", () => {
  it("rolls back the account deletion when the audit insert fails; retry removes the user with one audit row", async () => {
    if (!RUN) return;
    const targetId = await createTargetUser();

    insertAuditRowMock.mockRejectedValueOnce(
      new Error("injected audit failure")
    );

    const failed = await del(routes.deleteUser, "users", targetId);
    expect(failed.status).toBe(500);
    // The user still exists: the deletion rolled back with the audit.
    expect(await userExists(targetId)).toBe(true);
    expect(await auditCount("user.delete", targetId)).toBe(0);

    const ok = await del(routes.deleteUser, "users", targetId);
    expect(ok.status).toBe(200);
    expect(await userExists(targetId)).toBe(false);
    expect(await auditCount("user.delete", targetId)).toBe(1);
  });
});

describe("atomic audit — occupied-bed create", () => {
  it("rolls back the bed create when the audit insert fails; retry creates the bed with one bed.assign audit", async () => {
    if (!RUN) return;
    const patientId = await createPatient();

    insertAuditRowMock.mockRejectedValueOnce(
      new Error("injected audit failure")
    );

    const { NextRequest } = await import("next/server");
    const body = JSON.stringify({
      roomNumber: `AR-${randomUUID().slice(0, 6)}`,
      department: "Cardiology",
      type: "General",
      status: "Occupied",
      patientId,
    });
    const failedReq = new NextRequest("http://localhost:3000/api/beds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half" as const,
    } as ConstructorParameters<typeof import("next/server").NextRequest>[1]);
    const failed = await routes.createBed(failedReq);
    expect(failed.status).toBe(500);
    // No bed, no occupancy: the create rolled back with the audit.
    expect(await bedForPatient(patientId)).toBeUndefined();

    const okReq = new NextRequest("http://localhost:3000/api/beds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half" as const,
    } as ConstructorParameters<typeof import("next/server").NextRequest>[1]);
    const ok = await routes.createBed(okReq);
    expect(ok.status).toBe(201);
    const bedId = await bedForPatient(patientId);
    expect(bedId).toBeDefined();
    expect(await auditCount("bed.assign", bedId!)).toBe(1);

    // Immediate cleanup (not afterAll): seed.test.ts's DB-wide integrity
    // queries run concurrently in the shared *_test database and would
    // count an Occupied bed without an admission record as a violation.
    await ctx.pool.query("DELETE FROM beds WHERE id = $1", [bedId]);
  });
});

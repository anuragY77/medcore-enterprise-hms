// Phase 31: concurrency-invariant integration tests.
//
// The live Phase 31 probe proved the transactional guards under true parallel
// HTTP load; these tests encode the same races as committed regression
// coverage so CI keeps exercising them. They invoke the actual route handlers
// concurrently against the guarded *_test database (same pattern as
// clinical-workflows.test.ts: point DATABASE_URL at the test database before
// importing the routes so @/lib/db binds to it).
//
// Contracts under test (one winner, one 409, consistent final state):
//   - bed assign: two parallel assigns of one available bed to two patients
//     -> exactly one 200; the bed is Occupied with a single patientId.
//   - lab complete: two parallel completes of one Pending test -> exactly one
//     201; the test is Completed with a single result and one medical record.
//   - dispense: two parallel dispenses of one Active prescription (stock 5,
//     quantity 3 each) -> exactly one 201; stock never goes negative and the
//     prescription ends Completed exactly once.
//   - discharge: two parallel discharges of one admitted patient -> exactly
//     one 200; exactly one Discharge medical record exists.
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

import { auth } from "@/lib/auth";

const authMock = vi.mocked(auth);

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

type RaceRoutes = {
  assignBed: RouteHandler;
  completeLab: RouteHandler;
  dispense: RouteHandler;
  discharge: RouteHandler;
};

let ctx: IntegrationContext;
let actorId: string;
let routes: RaceRoutes;
const createdPatients: string[] = [];
const createdBeds: string[] = [];
const createdUsers: string[] = [];

function session(): TestSession {
  return {
    user: {
      id: actorId,
      name: "Concurrency Tester",
      email: "concurrency@medcore.test",
      role: "ADMIN",
      department: "Administration",
    },
    sessionId: "sid-concurrency",
    authAt: 1_700_000_000,
  };
}

async function call(
  handler: RouteHandler,
  id: string,
  body: unknown
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(
    `http://localhost:3000/api/${id}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      duplex: "half" as const,
    } as ConstructorParameters<typeof import("next/server").NextRequest>[1]
  );
  return handler(request, { params: Promise.resolve({ id }) });
}

async function createPatient(): Promise<string> {
  const id = randomUUID();
  const patientCode = `PT-CC-${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await ctx.pool.query(
    `INSERT INTO patients
       (id, patient_id, first_name, last_name, date_of_birth, gender,
        phone, department, attending_doctor, status)
     VALUES ($1, $2, 'Concurrency', 'Fixture', '1990-01-01', 'Other',
        '555-0000', 'Cardiology', 'Dr. Fixture', 'Active')`,
    [id, patientCode]
  );
  createdPatients.push(id);
  return id;
}

async function createBed(): Promise<string> {
  const id = randomUUID();
  const bedCode = `BED-CC-${randomUUID().replace(/-/g, "").slice(0, 13)}`;
  await ctx.pool.query(
    `INSERT INTO beds (id, bed_id, room_number, department, type, status, patient_id)
     VALUES ($1, $2, 'CC-1', 'Cardiology', 'General', 'Available', NULL)`,
    [id, bedCode]
  );
  createdBeds.push(id);
  return id;
}

async function createLabTest(patientId: string): Promise<string> {
  const id = randomUUID();
  const testCode = `LAB-CC-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await ctx.pool.query(
    `INSERT INTO lab_tests (id, test_id, patient_id, test_name, category, status, test_date)
     VALUES ($1, $2, $3, 'Concurrency CBC', 'Hematology', 'Pending', NOW())`,
    [id, testCode, patientId]
  );
  return id;
}

async function createMedicineAndPrescription(patientId: string) {
  const medId = randomUUID();
  const medCode = `MED-CC-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const medName = "Concurrency Drug " + randomUUID().slice(0, 8);
  await ctx.pool.query(
    `INSERT INTO pharmacy_medicines
       (id, medicine_id, name, generic_name, category, dosage,
        unit, stock_quantity, expiry_date, unit_price, status)
     VALUES ($1, $2, $3, 'concurrency', 'Analgesic', '500mg',
        'box', 5, NOW() + interval '1 year', 4.5, 'Active')`,
    [medId, medCode, medName]
  );
  const rxId = randomUUID();
  await ctx.pool.query(
    `INSERT INTO prescriptions
       (id, patient_id, medication_name, dosage, frequency, prescribed_by, status)
     VALUES ($1, $2, $3, '500mg', 'twice daily', 'Dr. Fixture', 'Active')`,
    [rxId, patientId, medName]
  );
  return { rxId, medId, medName };
}

async function bedRow(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT status, patient_id FROM beds WHERE id = $1",
    [id]
  );
  return rows[0] as { status: string; patient_id: string | null } | undefined;
}

async function labRow(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT status, result FROM lab_tests WHERE id = $1",
    [id]
  );
  return rows[0] as { status: string; result: string | null } | undefined;
}

async function countLabRecords(patientId: string, titlePrefix: string) {
  const { rows } = await ctx.pool.query(
    `SELECT count(*)::int AS n FROM medical_records
      WHERE patient_id = $1 AND record_type = 'Lab' AND title LIKE $2`,
    [patientId, titlePrefix + "%"]
  );
  return rows[0].n as number;
}

async function stockRow(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT stock_quantity FROM pharmacy_medicines WHERE id = $1",
    [id]
  );
  return rows[0]?.stock_quantity as number | undefined;
}

async function rxStatus(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT status FROM prescriptions WHERE id = $1",
    [id]
  );
  return rows[0]?.status as string | undefined;
}

async function countDischargeRecords(patientId: string) {
  const { rows } = await ctx.pool.query(
    `SELECT count(*)::int AS n FROM medical_records
      WHERE patient_id = $1 AND record_type = 'Discharge'`,
    [patientId]
  );
  return rows[0].n as number;
}

beforeAll(async () => {
  if (!RUN) return;
  ctx = await setupIntegration();
  process.env.DATABASE_URL = ctx.url;
  const { rows } = await ctx.pool.query(
    `INSERT INTO users (email, password, name, role, department)
     VALUES ($1, 'x', 'Concurrency Tester', 'ADMIN', 'Administration')
     RETURNING id`,
    [`concurrency-${Date.now()}@medcore.test`]
  );
  actorId = rows[0].id as string;
  createdUsers.push(actorId);
  const [assignModule, completeModule, dispenseModule, dischargeModule] =
    await Promise.all([
      import("@/app/api/beds/[id]/assign/route"),
      import("@/app/api/laboratory/[id]/complete/route"),
      import("@/app/api/pharmacy/prescriptions/[id]/dispense/route"),
      import("@/app/api/patients/[id]/discharge/route"),
    ]);
  routes = {
    assignBed: assignModule.POST,
    completeLab: completeModule.POST,
    dispense: dispenseModule.POST,
    discharge: dischargeModule.POST,
  };
});

afterAll(async () => {
  if (!ctx) return;
  if (actorId) {
    await ctx.pool.query("DELETE FROM audit_logs WHERE actor_id = $1", [
      actorId,
    ]);
  }
  if (createdBeds.length > 0) {
    await ctx.pool.query(`DELETE FROM beds WHERE id = ANY($1::uuid[])`, [
      createdBeds,
    ]);
  }
  if (createdPatients.length > 0) {
    await ctx.pool.query(`DELETE FROM patients WHERE id = ANY($1::uuid[])`, [
      createdPatients,
    ]);
  }
  if (createdUsers.length > 0) {
    await ctx.pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
      createdUsers,
    ]);
  }
  const dbModule = await import("@/lib/db");
  await Promise.resolve(
    (
      dbModule.db as unknown as { $client?: { end(): Promise<void> } }
    ).$client?.end?.()
  );
  await teardownIntegration(ctx);
});

beforeEach(() => {
  authMock.mockReset();
  if (RUN) authMock.mockResolvedValue(session() as Awaited<ReturnType<typeof auth>>);
});

describe.skipIf(!RUN)("concurrency invariants (Phase 31)", () => {
  it("same-bed concurrent assign: exactly one 200, bed Occupied with one patient", async () => {
    const [p1, p2, bedId] = [await createPatient(), await createPatient(), await createBed()];

    const [a, b] = await Promise.all([
      call(routes.assignBed, bedId, { patientId: p1 }),
      call(routes.assignBed, bedId, { patientId: p2 }),
    ]);

    const statuses = [a.status, b.status];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);

    const bed = await bedRow(bedId);
    expect(bed?.status).toBe("Occupied");
    expect([p1, p2]).toContain(bed?.patient_id);
  });

  it("concurrent lab complete: exactly one 201, single result and one Lab record", async () => {
    const patientId = await createPatient();
    const testId = await createLabTest(patientId);

    const [a, b] = await Promise.all([
      call(routes.completeLab, testId, { result: "HGB 13.5 normal" }),
      call(routes.completeLab, testId, { result: "HGB 9.1 low" }),
    ]);

    const statuses = [a.status, b.status];
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);

    const test = await labRow(testId);
    expect(test?.status).toBe("Completed");
    expect(test?.result).toBeTruthy();

    const recordCount = await countLabRecords(patientId, "Lab Result:");
    expect(recordCount).toBe(1);
  });

  it("concurrent dispense: exactly one 201, stock never negative, Rx completed once", async () => {
    const patientId = await createPatient();
    const { rxId, medId } = await createMedicineAndPrescription(patientId);

    const [a, b] = await Promise.all([
      call(routes.dispense, rxId, { quantity: 3 }),
      call(routes.dispense, rxId, { quantity: 3 }),
    ]);

    const statuses = [a.status, b.status];
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);

    const stock = await stockRow(medId);
    expect(stock).toBe(2);
    expect(await rxStatus(rxId)).toBe("Completed");
  });

  it("concurrent discharge: exactly one 200 and exactly one Discharge record", async () => {
    const patientId = await createPatient();
    const body = {
      diagnosis: "Recovered",
      treatmentSummary: "Full course completed",
      followUpInstructions: "None",
      medicationsOnDischarge: "None",
      followUpDate: "",
      notes: "",
    };

    const [a, b] = await Promise.all([
      call(routes.discharge, patientId, body),
      call(routes.discharge, patientId, { ...body, diagnosis: "Recovered again" }),
    ]);

    const statuses = [a.status, b.status];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);

    const { rows } = await ctx.pool.query(
      "SELECT status FROM patients WHERE id = $1",
      [patientId]
    );
    expect(rows[0]?.status).toBe("Discharged");
    expect(await countDischargeRecords(patientId)).toBe(1);
  });
});

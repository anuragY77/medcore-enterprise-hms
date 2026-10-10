// Phase 28: discharge + transfer workflow integration tests (PRD §9.3/§9.6).
//
// Committed coverage for these two mutations stopped at the 401/403 gate
// contracts (route-gates.test.ts, mocked db). Nothing exercised the state
// machine, the bed bookkeeping, rollback on database failure, or audit
// attribution against real SQL. These tests run the actual route handlers
// against the guarded *_test database (same pattern as
// session-endpoint-guard.test.ts: point DATABASE_URL at the test database
// before importing the routes so @/lib/db binds to it).
//
// Contract under test:
//   - discharge: patients:write gate, zod body, 404 unknown patient,
//     409 repeat discharge, atomic bed release + Discharge medical record,
//     patient.discharge audit with actor attribution, full rollback when the
//     database rejects a statement.
//   - transfer: beds:write (ADMIN) gate per PRD §9.6, 404 unknown patient /
//     bed, 409 no-occupancy / same-bed / unavailable-destination /
//     discharged-patient, atomic source-release + destination-claim,
//     patient.transfer audit with actor attribution, full rollback on
//     database failure.
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

type WorkflowRoutes = {
  discharge: RouteHandler;
  transfer: RouteHandler;
};

let ctx: IntegrationContext;
let actorId: string;
let routes: WorkflowRoutes;
const createdPatients: string[] = [];
const createdBeds: string[] = [];
let cleanupSql: string[] = [];

function session(role: string, name = "Workflow Tester"): TestSession {
  return {
    user: {
      id: actorId,
      name,
      email: "workflow@medcore.test",
      role,
      department: "Administration",
    },
    sessionId: "sid-workflow",
    authAt: 1_700_000_000,
  };
}

async function call(
  handler: RouteHandler,
  options: {
    id: string;
    body?: unknown;
    session?: TestSession | null;
  }
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  authMock.mockResolvedValue(
    (options.session === undefined
      ? session("ADMIN")
      : options.session) as Awaited<ReturnType<typeof auth>>
  );
  const request = new NextRequest(
    `http://localhost:3000/api/patients/${options.id}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body), duplex: "half" as const }
        : {}),
    } as ConstructorParameters<typeof import("next/server").NextRequest>[1]
  );
  return handler(request, { params: Promise.resolve({ id: options.id }) });
}

async function createPatient(status = "Active"): Promise<string> {
  const id = randomUUID();
  const patientCode = `PT-IT-${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await ctx.pool.query(
    `INSERT INTO patients
       (id, patient_id, first_name, last_name, date_of_birth, gender,
        phone, department, attending_doctor, status)
     VALUES ($1, $2, 'Integration', 'Workflow', '1990-01-01', 'Other',
        '555-0000', 'Cardiology', 'Dr. Fixture', $3)`,
    [id, patientCode, status]
  );
  createdPatients.push(id);
  return id;
}

async function createBed(
  patientId: string | null,
  status: string
): Promise<string> {
  const id = randomUUID();
  const bedCode = `BED-IT-${randomUUID().replace(/-/g, "").slice(0, 13)}`;
  await ctx.pool.query(
    `INSERT INTO beds (id, bed_id, room_number, department, type, status, patient_id)
     VALUES ($1, $2, 'IT-1', 'Cardiology', 'General', $3, $4)`,
    [id, bedCode, status, patientId]
  );
  createdBeds.push(id);
  return id;
}

async function patientStatus(id: string): Promise<string | undefined> {
  const { rows } = await ctx.pool.query(
    "SELECT status FROM patients WHERE id = $1",
    [id]
  );
  return rows[0]?.status as string | undefined;
}

async function bedRow(id: string) {
  const { rows } = await ctx.pool.query(
    "SELECT status, patient_id FROM beds WHERE id = $1",
    [id]
  );
  return rows[0] as { status: string; patient_id: string | null } | undefined;
}

async function auditRows(entityId: string, action: string) {
  const { rows } = await ctx.pool.query(
    `SELECT actor_id, action, category, success, metadata
       FROM audit_logs
      WHERE entity_id = $1 AND action = $2`,
    [entityId, action]
  );
  return rows as {
    actor_id: string;
    action: string;
    category: string | null;
    success: boolean | null;
    metadata: Record<string, unknown> | null;
  }[];
}

beforeAll(async () => {
  if (!RUN) return;
  ctx = await setupIntegration();
  // Point the app pool at the test database for this worker, then import the
  // routes so @/lib/db binds to it (fresh module graph per test file).
  process.env.DATABASE_URL = ctx.url;
  const { rows } = await ctx.pool.query(
    `INSERT INTO users (email, password, name, role, department)
     VALUES ($1, 'x', 'Workflow Tester', 'ADMIN', 'Administration')
     RETURNING id`,
    [`workflow-${Date.now()}@medcore.test`]
  );
  actorId = rows[0].id as string;
  const [dischargeModule, transferModule] = await Promise.all([
    import("@/app/api/patients/[id]/discharge/route"),
    import("@/app/api/patients/[id]/transfer/route"),
  ]);
  routes = {
    discharge: dischargeModule.POST,
    transfer: transferModule.POST,
  };
});

afterAll(async () => {
  if (!ctx) return;
  for (const sql of cleanupSql) {
    try {
      await ctx.pool.query(sql);
    } catch {
      // constraint may already be gone
    }
  }
  // audit_logs.actor_id is ON DELETE RESTRICT: audits must go first.
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
  if (actorId) {
    await ctx.pool.query("DELETE FROM users WHERE id = $1", [actorId]);
  }
  // End the route module's own pool (lazily created at import) so the worker
  // can exit; the drizzle instance exposes the pg Pool as $client.
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
});

describe.skipIf(!RUN)("discharge workflow integration (PRD §9.3)", () => {
  const DISCHARGE_BODY = {
    diagnosis: "Recovered",
    treatmentSummary: "Full course completed",
  };

  it("rejects an anonymous caller with 401", async () => {
    const res = await call(routes.discharge, {
      id: randomUUID(),
      body: DISCHARGE_BODY,
      session: null,
    });
    expect(res.status).toBe(401);
  });

  it("rejects a role without patients:write with 403 (PHARMACIST)", async () => {
    const res = await call(routes.discharge, {
      id: randomUUID(),
      body: DISCHARGE_BODY,
      session: session("PHARMACIST"),
    });
    expect(res.status).toBe(403);
  });

  it("rejects a non-uuid patient id with 400", async () => {
    const res = await call(routes.discharge, {
      id: "not-a-uuid",
      body: DISCHARGE_BODY,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Validation failed");
  });

  it("returns 404 for an unknown patient", async () => {
    const res = await call(routes.discharge, {
      id: randomUUID(),
      body: DISCHARGE_BODY,
    });
    expect(res.status).toBe(404);
  });

  it("rejects a body missing required fields with 400", async () => {
    const patientId = await createPatient();
    const res = await call(routes.discharge, {
      id: patientId,
      body: { diagnosis: "Recovered" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      details?: Record<string, string[] | undefined>;
    };
    expect(body.details?.treatmentSummary?.length).toBeGreaterThan(0);
    expect(await patientStatus(patientId)).toBe("Active");
  });

  it("discharges the patient, releases beds, writes the record, and audits with actor attribution", async () => {
    const patientId = await createPatient();
    const bedId = await createBed(patientId, "Occupied");

    const res = await call(routes.discharge, {
      id: patientId,
      body: {
        ...DISCHARGE_BODY,
        followUpInstructions: "Return in 2 weeks",
        notes: "Stable",
      },
      session: session("ADMIN", "Workflow Tester"),
    });
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { id: string; status: string };
    expect(payload.id).toBe(patientId);
    expect(payload.status).toBe("Discharged");

    expect(await patientStatus(patientId)).toBe("Discharged");
    const bed = await bedRow(bedId);
    expect(bed?.status).toBe("Available");
    expect(bed?.patient_id).toBeNull();

    const { rows: records } = await ctx.pool.query(
      `SELECT recorded_by FROM medical_records
        WHERE patient_id = $1 AND record_type = 'Discharge'`,
      [patientId]
    );
    expect(records).toHaveLength(1);
    expect(records[0].recorded_by).toBe("Workflow Tester");

    const audits = await auditRows(patientId, "patient.discharge");
    expect(audits).toHaveLength(1);
    expect(audits[0].actor_id).toBe(actorId);
    expect(audits[0].category).toBe("admission");
    expect(audits[0].success).toBe(true);
    expect(audits[0].metadata?.statusFrom).toBe("Active");
    expect(audits[0].metadata?.statusTo).toBe("Discharged");
    expect(audits[0].metadata?.releasedBeds).toHaveLength(1);
  });

  it("rejects a repeat discharge with 409 and writes no second record or audit", async () => {
    const patientId = await createPatient();
    const bedId = await createBed(patientId, "Occupied");

    const first = await call(routes.discharge, {
      id: patientId,
      body: DISCHARGE_BODY,
    });
    expect(first.status).toBe(200);

    const second = await call(routes.discharge, {
      id: patientId,
      body: DISCHARGE_BODY,
    });
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error?: string };
    expect(body.error).toBe("Patient is not currently admitted");

    const { rows: records } = await ctx.pool.query(
      `SELECT count(*)::int AS n FROM medical_records
        WHERE patient_id = $1 AND record_type = 'Discharge'`,
      [patientId]
    );
    expect(records[0].n).toBe(1);
    expect(await auditRows(patientId, "patient.discharge")).toHaveLength(1);
    // The failed repeat must not re-touch the already released bed.
    expect((await bedRow(bedId))?.status).toBe("Available");
  });

  it("rolls back bed release and status when the database rejects the update", async () => {
    const patientId = await createPatient();
    const bedId = await createBed(patientId, "Occupied");

    // NOT VALID skips validation of existing rows but enforces the check on
    // the UPDATE inside the discharge transaction, forcing a real rollback.
    await ctx.pool.query(
      `ALTER TABLE patients ADD CONSTRAINT it_no_discharge
         CHECK (status <> 'Discharged') NOT VALID`
    );
    cleanupSql.push(
      "ALTER TABLE patients DROP CONSTRAINT IF EXISTS it_no_discharge"
    );
    try {
      const res = await call(routes.discharge, {
        id: patientId,
        body: DISCHARGE_BODY,
      });
      expect(res.status).toBe(500);
    } finally {
      await ctx.pool.query(
        "ALTER TABLE patients DROP CONSTRAINT IF EXISTS it_no_discharge"
      );
      cleanupSql = cleanupSql.filter(
        (sql) => !sql.includes("it_no_discharge")
      );
    }

    expect(await patientStatus(patientId)).toBe("Active");
    const bed = await bedRow(bedId);
    expect(bed?.status).toBe("Occupied");
    expect(bed?.patient_id).toBe(patientId);
    expect(await auditRows(patientId, "patient.discharge")).toHaveLength(0);
  });
});

describe.skipIf(!RUN)("transfer workflow integration (PRD §9.6)", () => {
  it("rejects an anonymous caller with 401", async () => {
    const res = await call(routes.transfer, {
      id: randomUUID(),
      body: { bedId: randomUUID() },
      session: null,
    });
    expect(res.status).toBe(401);
  });

  it("rejects a role without beds:write with 403 (NURSE)", async () => {
    const res = await call(routes.transfer, {
      id: randomUUID(),
      body: { bedId: randomUUID() },
      session: session("NURSE"),
    });
    expect(res.status).toBe(403);
  });

  it("rejects a non-uuid patient id with 400", async () => {
    const res = await call(routes.transfer, {
      id: "not-a-uuid",
      body: { bedId: randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it("rejects a body without a uuid bedId with 400", async () => {
    const patientId = await createPatient();
    const res = await call(routes.transfer, {
      id: patientId,
      body: { bedId: "nope" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      details?: Record<string, string[] | undefined>;
    };
    expect(body.details?.bedId?.length).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown patient", async () => {
    const res = await call(routes.transfer, {
      id: randomUUID(),
      body: { bedId: randomUUID() },
    });
    expect(res.status).toBe(404);
  });

  it("transfers atomically: source released, destination claimed, audit attributed", async () => {
    const patientId = await createPatient();
    const sourceId = await createBed(patientId, "Occupied");
    const destinationId = await createBed(null, "Available");

    const res = await call(routes.transfer, {
      id: patientId,
      body: { bedId: destinationId },
      session: session("ADMIN"),
    });
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      patientId: string;
      sourceBed: { id: string; status: string; patientId: string | null };
      destinationBed: { id: string; status: string; patientId: string | null };
    };
    expect(payload.patientId).toBe(patientId);
    expect(payload.sourceBed.status).toBe("Available");
    expect(payload.sourceBed.patientId).toBeNull();
    expect(payload.destinationBed.status).toBe("Occupied");
    expect(payload.destinationBed.patientId).toBe(patientId);

    const source = await bedRow(sourceId);
    expect(source?.status).toBe("Available");
    expect(source?.patient_id).toBeNull();
    const destination = await bedRow(destinationId);
    expect(destination?.status).toBe("Occupied");
    expect(destination?.patient_id).toBe(patientId);

    const audits = await auditRows(patientId, "patient.transfer");
    expect(audits).toHaveLength(1);
    expect(audits[0].actor_id).toBe(actorId);
    expect(audits[0].category).toBe("admission");
    expect(audits[0].success).toBe(true);
    expect(audits[0].metadata?.sourceBedId).toBe(sourceId);
    expect(audits[0].metadata?.destinationBedId).toBe(destinationId);
  });

  it("returns 409 when the patient occupies no bed", async () => {
    const patientId = await createPatient();
    const res = await call(routes.transfer, {
      id: patientId,
      body: { bedId: await createBed(null, "Available") },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Patient does not occupy a bed");
  });

  it("returns 409 when the destination is the patient's own bed", async () => {
    const patientId = await createPatient();
    const bedId = await createBed(patientId, "Occupied");
    const res = await call(routes.transfer, {
      id: patientId,
      body: { bedId },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Patient is already assigned to this bed");
    expect((await bedRow(bedId))?.patient_id).toBe(patientId);
  });

  it("returns 409 when the destination bed is not available", async () => {
    const patientId = await createPatient();
    const sourceId = await createBed(patientId, "Occupied");
    const takenId = await createBed(null, "Occupied");
    const res = await call(routes.transfer, {
      id: patientId,
      body: { bedId: takenId },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Bed is not available for assignment");
    expect((await bedRow(sourceId))?.patient_id).toBe(patientId);
    expect((await bedRow(takenId))?.patient_id).toBeNull();
  });

  it("returns 409 for a discharged patient", async () => {
    const patientId = await createPatient("Discharged");
    const res = await call(routes.transfer, {
      id: patientId,
      body: { bedId: await createBed(null, "Available") },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Patient has been discharged");
  });

  it("returns 404 for an unknown destination bed", async () => {
    const patientId = await createPatient();
    await createBed(patientId, "Occupied");
    const res = await call(routes.transfer, {
      id: patientId,
      body: { bedId: randomUUID() },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Bed not found");
  });

  it("rolls back the source release when the database rejects the destination claim", async () => {
    const patientId = await createPatient();
    const sourceId = await createBed(patientId, "Occupied");
    const destinationId = await createBed(null, "Available");

    // Source is released first, destination claimed second; NOT VALID keeps
    // existing Occupied rows legal while failing the destination UPDATE.
    await ctx.pool.query(
      `ALTER TABLE beds ADD CONSTRAINT it_no_occupied
         CHECK (status <> 'Occupied') NOT VALID`
    );
    cleanupSql.push(
      "ALTER TABLE beds DROP CONSTRAINT IF EXISTS it_no_occupied"
    );
    try {
      const res = await call(routes.transfer, {
        id: patientId,
        body: { bedId: destinationId },
      });
      expect(res.status).toBe(500);
    } finally {
      await ctx.pool.query(
        "ALTER TABLE beds DROP CONSTRAINT IF EXISTS it_no_occupied"
      );
      cleanupSql = cleanupSql.filter((sql) => !sql.includes("it_no_occupied"));
    }

    const source = await bedRow(sourceId);
    expect(source?.status).toBe("Occupied");
    expect(source?.patient_id).toBe(patientId);
    const destination = await bedRow(destinationId);
    expect(destination?.status).toBe("Available");
    expect(destination?.patient_id).toBeNull();
    expect(await auditRows(patientId, "patient.transfer")).toHaveLength(0);
  });
});

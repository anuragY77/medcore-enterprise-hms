// Phase 23: malformed JSON/text request bodies.
//
// 28 of 40 API route handlers called `await request.json()` without a guard,
// so a client sending invalid JSON (or any non-JSON body) triggered an
// unhandled SyntaxError and a 500 that surfaced as an opaque server error.
// Every handler now parses inside try/catch and returns the shared
// 400 shape `details.body: ["Invalid JSON"]` before any database access.
// These tests fail if any of the guarded parse blocks are reverted.
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  insertValues: [] as unknown[],
  updateValues: [] as unknown[],
  insertRow: null as unknown,
  updateRow: null as unknown,
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/business-id", () => ({
  nextBusinessId: vi.fn(async () => "PT-900001"),
}));
vi.mock("@/lib/db", () => {
  const tableStub = () =>
    new Proxy(
      {},
      {
        get: (_target, prop) =>
          typeof prop === "symbol" ? undefined : String(prop),
      }
    );

  const makeChain = (result: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const method of [
      "from",
      "where",
      "orderBy",
      "limit",
      "offset",
      "groupBy",
      "for",
      "returning",
      "set",
    ]) {
      chain[method] = () => chain;
    }
    chain.values = (values: unknown) => {
      dbCtl.insertValues.push(values);
      return chain;
    };
    chain.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  };

  return {
    db: {
      select: () => makeChain(dbCtl.selectRows),
      insert: () => makeChain([dbCtl.insertRow]),
      update: () => makeChain([dbCtl.updateRow]),
    },
    departments: tableStub(),
    staff: tableStub(),
    patients: tableStub(),
    users: tableStub(),
    appointments: tableStub(),
    invoices: tableStub(),
    insuranceClaims: tableStub(),
  };
});

import { auth } from "@/lib/auth";
import { POST as postPatient } from "@/app/api/patients/route";
import { PUT as putUser } from "@/app/api/users/[id]/route";
import { POST as postAppointment } from "@/app/api/appointments/route";
import { PUT as putInvoice } from "@/app/api/billing/[id]/route";

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

function session(role: string): TestSession {
  return {
    user: {
      id: "usr_json_1",
      name: "Test Admin",
      email: "admin@medcore.test",
      role,
      department: "Administration",
    },
    sessionId: "sid-json-1",
    authAt: 1_700_000_000,
  };
}

type RouteHandler = (
  request: import("next/server").NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

type NextRequestInit = ConstructorParameters<
  typeof import("next/server").NextRequest
>[1];

async function callRaw(
  handler: RouteHandler,
  options: {
    url: string;
    method: "POST" | "PUT";
    rawBody: string;
    contentType?: string;
    session?: TestSession | null;
  }
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  authMock.mockResolvedValue(
    (options.session === undefined
      ? session("ADMIN")
      : options.session) as Awaited<ReturnType<typeof auth>>
  );
  const request = new NextRequest(options.url, {
    method: options.method,
    headers: { "content-type": options.contentType ?? "application/json" },
    body: options.rawBody,
    duplex: "half" as const,
  } as unknown as NextRequestInit);
  return handler(request, {
    params: Promise.resolve({ id: "3f1d2a7c-9b64-4e21-8a5f-1c2d3e4f5a6b" }),
  });
}

async function expectInvalidJson(res: Response) {
  expect(res.status).toBe(400);
  const body = (await res.json()) as {
    error?: string;
    details?: { body?: string[] };
  };
  expect(body.error).toBe("Validation failed");
  expect(body.details?.body).toEqual(["Invalid JSON"]);
}

describe("malformed JSON bodies return 400 instead of 500 (Phase 23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCtl.selectRows = [];
    dbCtl.insertValues = [];
    dbCtl.updateValues = [];
    dbCtl.insertRow = { id: "new", status: "Active" };
    dbCtl.updateRow = { id: "upd" };
  });

  it("POST /api/patients rejects invalid JSON without touching the database", async () => {
    const res = await callRaw(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      rawBody: '{"firstName": "Ada", ',
    });
    await expectInvalidJson(res);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("POST /api/patients rejects a text/plain body", async () => {
    const res = await callRaw(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      rawBody: "hello world",
      contentType: "text/plain",
    });
    await expectInvalidJson(res);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("PUT /api/users/[id] rejects invalid JSON without updating", async () => {
    const res = await callRaw(putUser, {
      url: "http://localhost:3000/api/users/3f1d2a7c-9b64-4e21-8a5f-1c2d3e4f5a6b",
      method: "PUT",
      rawBody: "not json at all",
    });
    await expectInvalidJson(res);
    expect(dbCtl.updateValues).toHaveLength(0);
  });

  it("POST /api/appointments rejects invalid JSON without inserting", async () => {
    const res = await callRaw(postAppointment, {
      url: "http://localhost:3000/api/appointments",
      method: "POST",
      rawBody: "<html>surprise</html>",
    });
    await expectInvalidJson(res);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("PUT /api/billing/[id] rejects an empty body", async () => {
    const res = await callRaw(putInvoice, {
      url: "http://localhost:3000/api/billing/inv-1",
      method: "PUT",
      rawBody: "",
    });
    await expectInvalidJson(res);
    expect(dbCtl.updateValues).toHaveLength(0);
  });
});

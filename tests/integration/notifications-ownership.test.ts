// Phase 36: notification ownership scoping regression tests.
//
// Notifications are the only owner-scoped resource family in the app: GET
// filters by recipientId and PATCH carries the recipientId predicate into
// the UPDATE's WHERE clause, so another user's row is invisible and
// untouchable (404, and the row is provably unchanged). No committed test
// asserted this before Phase 36 — the audit found the implementation correct
// but untested, meaning a future refactor that drops `recipientId` from the
// UPDATE predicate (a one-line change) would silently turn every
// mark-as-read endpoint into a cross-user write with nothing failing.
//
// These tests run the real route handlers against the guarded *_test
// database (same pattern as clinical-workflows.test.ts: point DATABASE_URL
// at the test database before importing the routes so @/lib/db binds to it).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

type PatchHandler = (
  request: import("next/server").NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

type GetHandler = (
  request: import("next/server").NextRequest
) => Promise<Response>;

let ctx: IntegrationContext;
let ownerUserId: string;
let otherUserId: string;
let ownerNotificationId: string;
let patchHandler: PatchHandler;
let getHandler: GetHandler;
const createdUsers: string[] = [];

function session(userId: string, role: string): TestSession {
  return {
    user: {
      id: userId,
      name: "Notification Tester",
      email: "notifications@medcore.test",
      role,
      department: "Administration",
    },
    sessionId: "sid-notifications",
    authAt: 1_700_000_000,
  };
}

async function patchCall(
  id: string,
  sessionValue: TestSession | null
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  authMock.mockResolvedValue(
    sessionValue as unknown as Awaited<ReturnType<typeof auth>>
  );
  const request = new NextRequest(
    `http://localhost:3000/api/notifications/${id}`,
    { method: "PATCH", headers: { "content-type": "application/json" } }
  );
  return patchHandler(request, { params: Promise.resolve({ id }) });
}

async function listCall(sessionValue: TestSession): Promise<Response> {
  const { NextRequest } = await import("next/server");
  authMock.mockResolvedValue(
    sessionValue as unknown as Awaited<ReturnType<typeof auth>>
  );
  const request = new NextRequest(
    "http://localhost:3000/api/notifications",
    { method: "GET" }
  );
  return getHandler(request);
}

describe.skipIf(!RUN)("notification ownership scoping (Phase 36)", () => {
  beforeAll(async () => {
    ctx = await setupIntegration();

    const owner = await ctx.pool.query(
      `INSERT INTO users (email, password, name, role, department)
       VALUES ($1, 'x', 'Notification Owner', 'NURSE', 'Cardiology')
       RETURNING id`,
      [`notif-owner-${Date.now()}@medcore.test`]
    );
    ownerUserId = owner.rows[0].id as string;
    createdUsers.push(ownerUserId);

    const other = await ctx.pool.query(
      `INSERT INTO users (email, password, name, role, department)
       VALUES ($1, 'x', 'Notification Other', 'NURSE', 'Cardiology')
       RETURNING id`,
      [`notif-other-${Date.now()}@medcore.test`]
    );
    otherUserId = other.rows[0].id as string;
    createdUsers.push(otherUserId);

    const note = await ctx.pool.query(
      `INSERT INTO notifications (recipient_id, title, message, type)
       VALUES ($1, 'Ownership fixture', 'synthetic fixture row', 'SYSTEM')
       RETURNING id`,
      [ownerUserId]
    );
    ownerNotificationId = note.rows[0].id as string;

    // Bind @/lib/db to the guarded test database before importing routes.
    process.env.DATABASE_URL = ctx.url;
    const patchModule = await import(
      "@/app/api/notifications/[id]/route"
    );
    const getModule = await import("@/app/api/notifications/route");
    patchHandler = patchModule.PATCH;
    getHandler = getModule.GET;
  }, 120_000);

  afterAll(async () => {
    if (ctx) {
      // Users own their notifications via ON DELETE CASCADE.
      for (const id of createdUsers) {
        await ctx.pool.query("DELETE FROM users WHERE id = $1", [id]);
      }
    }
    await teardownIntegration(ctx);
    delete process.env.DATABASE_URL;
  });

  it("rejects unauthenticated PATCH with 401", async () => {
    const res = await patchCall(ownerNotificationId, null);
    expect(res.status).toBe(401);
  });

  it("another user's PATCH returns 404 and leaves the row unread", async () => {
    const res = await patchCall(ownerNotificationId, session(otherUserId, "NURSE"));
    expect(res.status).toBe(404);
    const { rows } = await ctx.pool.query(
      "SELECT is_read, read_at FROM notifications WHERE id = $1",
      [ownerNotificationId]
    );
    expect(rows[0].is_read).toBe(false);
    expect(rows[0].read_at).toBeNull();
  });

  it("the owner's PATCH returns 200 and marks the row read", async () => {
    const res = await patchCall(ownerNotificationId, session(ownerUserId, "NURSE"));
    expect(res.status).toBe(200);
    const { rows } = await ctx.pool.query(
      "SELECT is_read, read_at FROM notifications WHERE id = $1",
      [ownerNotificationId]
    );
    expect(rows[0].is_read).toBe(true);
    expect(rows[0].read_at).not.toBeNull();
  });

  it("another user's later PATCH still 404s (ownership, not read-state)", async () => {
    const res = await patchCall(ownerNotificationId, session(otherUserId, "NURSE"));
    expect(res.status).toBe(404);
  });

  it("GET lists never leak another user's notifications", async () => {
    const otherRes = await listCall(session(otherUserId, "NURSE"));
    expect(otherRes.status).toBe(200);
    const otherBody = (await otherRes.json()) as {
      data: Array<{ id: string; recipientId: string }>;
    };
    expect(
      otherBody.data.some((n) => n.id === ownerNotificationId)
    ).toBe(false);
    expect(
      otherBody.data.every((n) => n.recipientId === otherUserId)
    ).toBe(true);

    const ownerRes = await listCall(session(ownerUserId, "NURSE"));
    expect(ownerRes.status).toBe(200);
    const ownerBody = (await ownerRes.json()) as {
      data: Array<{ id: string; recipientId: string }>;
    };
    expect(ownerBody.data.some((n) => n.id === ownerNotificationId)).toBe(true);
    expect(
      ownerBody.data.every((n) => n.recipientId === ownerUserId)
    ).toBe(true);
  });

  it("an unknown but well-formed notification id 404s for its would-be owner path", async () => {
    const res = await patchCall(randomUUID(), session(ownerUserId, "NURSE"));
    expect(res.status).toBe(404);
  });
});

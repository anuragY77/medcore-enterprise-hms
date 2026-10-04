import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// ---------------------------------------------------------------------------
// Gating rules (all must pass before any destructive setup runs):
//   1. TEST_DATABASE_URL must be explicitly set. It is NEVER defaulted from
//      DATABASE_URL, so production credentials are never reused implicitly.
//   2. The URL must be a parseable postgres scheme (postgresql:/postgres:).
//   3. The target database name must end with "_test" (case-insensitive) —
//      the refusal mechanism against production-like databases.
//   4. The target pathname must differ from DATABASE_URL's pathname — even
//      when both URLs are literally identical strings (fail closed whenever
//      the same database cannot be ruled out, including when DATABASE_URL
//      itself is unparseable).
// If TEST_DATABASE_URL is absent, the integration suite is skipped (unit
// tests still run) rather than failed, so local development stays frictionless.
// ---------------------------------------------------------------------------

const rawUrl = process.env.TEST_DATABASE_URL?.trim();
export const integrationEnabled = Boolean(rawUrl);

function assertGuardedTarget(): string {
  if (!rawUrl) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a parseable URL");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(
      `Refusing to run: unsupported scheme "${parsed.protocol}" — ` +
        "expected postgresql:// or postgres://"
    );
  }
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!/_test$/i.test(dbName)) {
    throw new Error(
      `Refusing to run: database "${dbName}" does not end with "_test". ` +
        "Integration tests only run against dedicated *_test databases."
    );
  }
  const appUrl = process.env.DATABASE_URL;
  if (appUrl) {
    let appParsed: URL;
    try {
      appParsed = new URL(appUrl);
    } catch {
      throw new Error(
        "Refusing to run: DATABASE_URL is set but not parseable, so " +
          "TEST_DATABASE_URL cannot be verified as a different database."
      );
    }
    if (appParsed.pathname === parsed.pathname) {
      throw new Error(
        "Refusing to run: TEST_DATABASE_URL points at the same database as " +
          "DATABASE_URL. Point TEST_DATABASE_URL at a *_test database."
      );
    }
  }
  return rawUrl;
}

/** Create the *_test database if it does not exist (maintenance connection). */
async function ensureDatabase(url: string): Promise<void> {
  const parsed = new URL(url);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const pool = new Pool({ connectionString: maintenance.toString() });
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (rows.length === 0) {
      // Database names come from a validated identifier, never user input;
      // quote it anyway (pg does not support placeholders for identifiers).
      await pool.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await pool.end();
  }
}

/** Apply committed migrations to the target database via drizzle-kit. */
export function applyMigrations(url: string): void {
  try {
    execFileSync("npx", ["drizzle-kit", "migrate"], {
      cwd: ROOT,
      shell: process.platform === "win32",
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch (error) {
    const detail =
      error && typeof error === "object" && "stderr" in error
        ? String((error as { stderr: Buffer }).stderr ?? "")
        : "";
    throw new Error(
      `drizzle-kit migrate failed against the test database:\n${detail}`
    );
  }
}

export interface IntegrationContext {
  url: string;
  pool: Pool;
}

export async function setupIntegration(): Promise<IntegrationContext> {
  const url = assertGuardedTarget();
  await ensureDatabase(url);
  applyMigrations(url);
  const pool = new Pool({ connectionString: url, max: 4 });
  return { url, pool };
}

export async function teardownIntegration(
  ctx: IntegrationContext | undefined
): Promise<void> {
  await ctx?.pool.end();
}

/**
 * Safety guard for the demo-data seed.
 *
 * The seed writes a large amount of synthetic data, so it must never run
 * against anything that could be a real or production database. All checks
 * fail closed: an unparseable URL, an unknown host, a missing NODE_ENV or a
 * missing explicit confirmation each abort the run before a connection is
 * opened. Mirrors the philosophy of the integration-test guard in
 * tests/integration/helpers.ts, but for the seed CLI.
 */

export class SeedGuardError extends Error {
  override readonly name = "SeedGuardError";
}

export interface SeedTarget {
  host: string;
  database: string;
}

/** Loopback hosts that a local development/demo database may live on. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Substrings that make a database name look production-like. The seed only
 * runs against local development/demo/test databases, so anything carrying
 * one of these markers is refused.
 */
const PRODUCTION_LIKE_MARKERS = [
  "prod",
  "production",
  "staging",
  "stage",
  "uat",
  "release",
  "live",
  "customer",
  "client",
  "primary",
];

const POSTGRES_PROTOCOLS = new Set(["postgresql:", "postgres:"]);

/** Parse a postgres URL into a seed target, refusing anything suspicious. */
export function parseSeedTarget(databaseUrl: string | undefined | null): SeedTarget {
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new SeedGuardError(
      "No database URL provided. Set DATABASE_URL (for example in .env.local)."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl.trim());
  } catch {
    throw new SeedGuardError(
      "Database URL is not parseable, so the seed target cannot be verified. " +
        "Fix DATABASE_URL and try again."
    );
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new SeedGuardError(
      `Refusing to seed: unsupported scheme "${parsed.protocol}" — ` +
        "expected postgresql:// or postgres://."
    );
  }

  // URL parsing keeps the case of non-special-scheme hosts (postgres: is not
  // a special scheme), so normalize before the loopback comparison. This only
  // maps case variants onto the exact loopback literals below — it cannot turn
  // a foreign host into one of them.
  const host = parsed.hostname.toLowerCase();
  if (!host || !LOOPBACK_HOSTS.has(host)) {
    throw new SeedGuardError(
      `Refusing to seed: host "${host || "(empty)"}" is not loopback. ` +
        "Demo data may only be seeded into a database on this machine " +
        "(localhost, 127.0.0.1 or ::1)."
    );
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) {
    throw new SeedGuardError("Refusing to seed: database name is empty.");
  }

  const lower = database.toLowerCase();
  const matchedMarker = PRODUCTION_LIKE_MARKERS.find((marker) =>
    lower.includes(marker)
  );
  if (matchedMarker) {
    throw new SeedGuardError(
      `Refusing to seed: database name "${database}" looks production-like ` +
        `(contains "${matchedMarker}"). Use a local development/demo/test ` +
        "database instead."
    );
  }

  return { host, database };
}

export interface SeedGuardOptions {
  databaseUrl: string | undefined;
  /** Current NODE_ENV value (development or test only). */
  nodeName: string | undefined;
  /** Explicit operator confirmation (CLI --demo flag or SEED_DEMO_DATA=1). */
  confirmed: boolean;
}

/**
 * Full seed guard. Returns the verified target or throws SeedGuardError.
 * Never opens a connection and never reads process.env itself, so every
 * branch is unit-testable.
 */
export function assertSeedTarget(options: SeedGuardOptions): SeedTarget {
  const target = parseSeedTarget(options.databaseUrl);

  const env = options.nodeName?.trim().toLowerCase();
  if (env !== "development" && env !== "test") {
    throw new SeedGuardError(
      `Refusing to seed: NODE_ENV is "${options.nodeName ?? ""}" — the demo ` +
        "seed only runs with NODE_ENV=development (or test in automated " +
        "tests). It never runs against production."
    );
  }

  if (!options.confirmed) {
    throw new SeedGuardError(
      "Refusing to seed: demo data requires explicit confirmation. " +
        "Re-run with the --demo flag (or set SEED_DEMO_DATA=1) once you " +
        "have verified this is a local development/demo database."
    );
  }

  return target;
}

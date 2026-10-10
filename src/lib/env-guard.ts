// Phase 29: production environment validation.
//
// Before this guard, `AUTH_SECRET` flowed into Auth.js through an implicit
// env read (`process.env.AUTH_SECRET!` at the sign-out decode site) with no
// startup check: a deployment built from `.env.example` would happily sign
// session JWTs with the PUBLIC example string `replace-with-a-secure-secret`,
// and a missing secret would only surface as an opaque MISSING_SECRET error
// on the first auth request. Validation is pure (injectable env, no process
// access) so every rule is unit-testable, and error messages describe the
// broken rule WITHOUT echoing the value — a secret must never reach logs.

/** The literal placeholder shipped in .env.example — never valid in prod. */
export const EXAMPLE_AUTH_SECRET = "replace-with-a-secure-secret";
/** The literal placeholder shipped in .env.example — never valid in prod. */
export const EXAMPLE_DATABASE_URL =
  "postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME";

/**
 * Values that are intentionally public (committed in this repository) and
 * therefore worthless as production signing keys. Compared case-insensitively.
 */
const PUBLICLY_KNOWN_SECRETS = new Set([
  EXAMPLE_AUTH_SECRET,
  "ci-build-only-dummy-secret",
]);

/**
 * `openssl rand -base64 32` (the command documented in .env.example and the
 * README) yields 43 characters; anything under 32 characters is below the
 * Auth.js guidance regardless of alphabet.
 */
const MIN_AUTH_SECRET_LENGTH = 32;

export interface EnvSnapshot {
  AUTH_SECRET?: string | undefined;
  DATABASE_URL?: string | undefined;
}

/**
 * Returns one message per violated rule; an empty array means the snapshot
 * is safe to boot a production server with. Pure — never reads process.env
 * itself (pass `process.env` at the call site).
 */
export function productionEnvErrors(
  env: EnvSnapshot | NodeJS.ProcessEnv
): string[] {
  const errors: string[] = [];

  const secret = env.AUTH_SECRET?.trim();
  if (!secret) {
    errors.push("AUTH_SECRET is not set");
  } else if (PUBLICLY_KNOWN_SECRETS.has(secret.toLowerCase())) {
    errors.push(
      "AUTH_SECRET is a publicly known placeholder (from .env.example or CI) and cannot sign production sessions"
    );
  } else if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    errors.push(
      `AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters (generate one with: openssl rand -base64 32)`
    );
  }

  const url = env.DATABASE_URL?.trim();
  if (!url) {
    errors.push("DATABASE_URL is not set");
  } else if (url === EXAMPLE_DATABASE_URL) {
    errors.push("DATABASE_URL is the .env.example placeholder");
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      errors.push("DATABASE_URL is not a valid URL");
    }
    if (parsed) {
      if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
        errors.push("DATABASE_URL must use the postgresql:// scheme");
      } else {
        if (!parsed.hostname) errors.push("DATABASE_URL is missing a host");
        if (!parsed.pathname.replace(/^\//, "")) {
          errors.push("DATABASE_URL is missing a database name");
        }
      }
    }
  }

  return errors;
}

/**
 * Throws a descriptive error when the production environment is unusable;
 * returns silently when every rule passes. Call only from server-start
 * paths (see src/instrumentation.ts) so builds, tests, and dev servers are
 * unaffected.
 */
export function assertProductionEnv(
  env: EnvSnapshot | NodeJS.ProcessEnv = process.env
): void {
  const errors = productionEnvErrors(env);
  if (errors.length > 0) {
    throw new Error(
      `[env-guard] refusing to start a production server: ${errors.join("; ")}. ` +
        "Set real values in the deployment environment (see .env.example)."
    );
  }
}

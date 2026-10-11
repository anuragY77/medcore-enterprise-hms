// Phase 29/30: production environment validation (fail-fast credential guard).
//
// Phase 29 locked down the AUTH_SECRET defect: the secret was consumed via an
// implicit env read with no startup check, so a deployment built from
// .env.example would sign session JWTs with the PUBLIC example string, and a
// missing secret surfaced only as an opaque error on the first auth request.
// These tests pin every rule AND the no-echo guarantee: error text may
// describe the broken rule but must never contain the secret value itself.
//
// Phase 30 adds the host-trust rule: Auth.js derives `trustHost` from
// AUTH_URL ?? AUTH_TRUST_HOST ?? (NODE_ENV !== "production"), so a
// production boot without either one rejects every auth request with
// UntrustedHost (500) while /login keeps serving its static shell —
// reproduced live in Phase 30 against `next start` on port 3005.
import { describe, expect, it } from "vitest";
import {
  EXAMPLE_AUTH_SECRET,
  EXAMPLE_DATABASE_URL,
  assertProductionEnv,
  productionEnvErrors,
} from "@/lib/env-guard";

const STRONG_SECRET = "q7Xm2pL9vR4tY1wZ8nB6cD3fH5jK0aE"; // 31 chars
const VALID_URL = "postgresql://postgres:pw@localhost:5432/medcore";
const VALID_AUTH_URL = "https://hms.example.com";

function errs(env: {
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
  AUTH_URL?: string;
  AUTH_TRUST_HOST?: string;
}): string[] {
  return productionEnvErrors(env);
}

/** A snapshot that passes every rule except the ones under test. */
function ok(overrides: {
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
  AUTH_URL?: string;
  AUTH_TRUST_HOST?: string;
} = {}): {
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
  AUTH_URL?: string;
  AUTH_TRUST_HOST?: string;
} {
  return {
    AUTH_SECRET: `${STRONG_SECRET}g`,
    DATABASE_URL: VALID_URL,
    AUTH_URL: VALID_AUTH_URL,
    ...overrides,
  };
}

describe("productionEnvErrors (env guard)", () => {
  it("accepts a well-formed production snapshot", () => {
    expect(errs(ok())).toEqual([]);
  });

  it("accepts a long random base64 secret (openssl rand -base64 32 output shape)", () => {
    expect(
      errs(
        ok({
          AUTH_SECRET:
            "bXlzZWNyZXQtZm9yLXByb2R1Y3Rpb24tdXNlLWdlbi1yYW5kb20",
        })
      )
    ).toEqual([]);
  });

  it("rejects a missing, empty, or whitespace-only AUTH_SECRET", () => {
    expect(errs(ok({ AUTH_SECRET: undefined }))).toEqual([
      "AUTH_SECRET is not set",
    ]);
    expect(errs(ok({ AUTH_SECRET: "" }))).toEqual(["AUTH_SECRET is not set"]);
    expect(errs(ok({ AUTH_SECRET: "   " }))).toEqual([
      "AUTH_SECRET is not set",
    ]);
  });

  it("rejects the .env.example placeholder secret (the core defect)", () => {
    const errors = errs(ok({ AUTH_SECRET: EXAMPLE_AUTH_SECRET }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("publicly known placeholder");
  });

  it("rejects the CI dummy secret — it is committed in .github/workflows", () => {
    const errors = errs(ok({ AUTH_SECRET: "ci-build-only-dummy-secret" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("publicly known placeholder");
  });

  it("rejects secrets shorter than 32 characters and enforces the boundary", () => {
    const short = errs(ok({ AUTH_SECRET: STRONG_SECRET })); // 31
    expect(short).toHaveLength(1);
    expect(short[0]).toContain("at least 32 characters");

    const boundary = errs(ok({ AUTH_SECRET: `${STRONG_SECRET}g` })); // 32
    expect(boundary).toEqual([]);
  });

  it("rejects a missing, placeholder, or non-postgres DATABASE_URL", () => {
    expect(errs(ok({ DATABASE_URL: undefined }))).toEqual([
      "DATABASE_URL is not set",
    ]);
    expect(errs(ok({ DATABASE_URL: EXAMPLE_DATABASE_URL }))).toEqual([
      "DATABASE_URL is the .env.example placeholder",
    ]);
    expect(
      errs(ok({ DATABASE_URL: "mysql://user:pw@dbhost/app" }))
    ).toEqual(["DATABASE_URL must use the postgresql:// scheme"]);
    expect(errs(ok({ DATABASE_URL: "not a url" }))).toEqual([
      "DATABASE_URL is not a valid URL",
    ]);
    expect(
      errs(ok({ DATABASE_URL: "postgresql://localhost:5432" }))
    ).toEqual(["DATABASE_URL is missing a database name"]);
    expect(
      errs(ok({ DATABASE_URL: "postgres://localhost:5432/app" }))
    ).toEqual([]);
  });

  it("reports every violated rule at once", () => {
    expect(errs({})).toEqual([
      "AUTH_SECRET is not set",
      "AUTH_URL (or AUTH_TRUST_HOST) is not set — production Auth.js rejects every auth request with UntrustedHost without it (set AUTH_URL to the public origin, e.g. https://hms.example.com)",
      "DATABASE_URL is not set",
    ]);
  });
});

describe("productionEnvErrors host-trust rules (Phase 30)", () => {
  it("rejects production with neither AUTH_URL nor AUTH_TRUST_HOST (reproduced UntrustedHost)", () => {
    const errors = errs(ok({ AUTH_URL: undefined }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("UntrustedHost");
    expect(errors[0]).toContain("AUTH_URL");
  });

  it("rejects whitespace-only values for both host-trust variables", () => {
    const errors = errs(ok({ AUTH_URL: "   ", AUTH_TRUST_HOST: "  " }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("UntrustedHost");
  });

  it("accepts AUTH_TRUST_HOST alone (Auth.js treats any non-empty value as trust)", () => {
    expect(
      errs(ok({ AUTH_URL: undefined, AUTH_TRUST_HOST: "1" }))
    ).toEqual([]);
  });

  it("accepts http://localhost AUTH_URL (local production-like boots)", () => {
    expect(errs(ok({ AUTH_URL: "http://localhost:3000" }))).toEqual([]);
  });

  it("accepts a whitespace-padded AUTH_URL", () => {
    expect(errs(ok({ AUTH_URL: `  ${VALID_AUTH_URL}  ` }))).toEqual([]);
  });

  it("rejects a malformed AUTH_URL", () => {
    const errors = errs(ok({ AUTH_URL: "not a url" }));
    expect(errors).toEqual(["AUTH_URL is not a valid URL"]);
  });

  it("rejects a non-http(s) AUTH_URL scheme", () => {
    const errors = errs(ok({ AUTH_URL: "ftp://hms.example.com" }));
    expect(errors).toEqual(["AUTH_URL must use http:// or https://"]);
  });

  it("never echoes AUTH_URL or DATABASE_URL values in combined messages", () => {
    const canaryDb = "postgresl://user:DBCANARYpw@localhost/db";
    const canaryUrl = "notaurl-CANARY";
    let message = "";
    try {
      assertProductionEnv(
        ok({ AUTH_URL: canaryUrl, DATABASE_URL: canaryDb })
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("[env-guard]");
    expect(message).toContain("AUTH_URL is not a valid URL");
    expect(message).toContain(
      "DATABASE_URL must use the postgresql:// scheme"
    );
    expect(message).not.toContain("DBCANARYpw");
    expect(message).not.toContain("notaurl-CANARY");
  });
});

describe("assertProductionEnv (fail-fast)", () => {
  it("returns silently for a valid snapshot", () => {
    expect(() => assertProductionEnv(ok())).not.toThrow();
  });

  it("throws a descriptive error for a placeholder secret", () => {
    expect(() =>
      assertProductionEnv(ok({ AUTH_SECRET: EXAMPLE_AUTH_SECRET }))
    ).toThrow(/\[env-guard\] refusing to start a production server/);
  });

  it("never echoes the secret value in the thrown message", () => {
    const weakButPrivate = "hunter2-too-short-but-private";
    let message = "";
    try {
      assertProductionEnv(ok({ AUTH_SECRET: weakButPrivate }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("[env-guard]");
    expect(message).toContain("at least 32 characters");
    expect(message).not.toContain(weakButPrivate);
    expect(message).not.toContain("hunter2");
  });

  it("never echoes the database password when the URL is invalid", () => {
    let message = "";
    try {
      assertProductionEnv(
        ok({ DATABASE_URL: "postgresl://user:SUPERSECRETpw@localhost/db" })
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(
      "DATABASE_URL must use the postgresql:// scheme"
    );
    expect(message).not.toContain("SUPERSECRETpw");
  });
});

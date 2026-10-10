// Phase 29: production environment validation (fail-fast credential guard).
//
// The defect this locks down: AUTH_SECRET was consumed via an implicit env
// read with no startup check, so a deployment built from .env.example would
// sign session JWTs with the PUBLIC example string, and a missing secret
// surfaced only as an opaque error on the first auth request. These tests
// pin every rule AND the no-echo guarantee: error text may describe the
// broken rule but must never contain the secret value itself.
import { describe, expect, it } from "vitest";
import {
  EXAMPLE_AUTH_SECRET,
  EXAMPLE_DATABASE_URL,
  assertProductionEnv,
  productionEnvErrors,
} from "@/lib/env-guard";

const STRONG_SECRET = "q7Xm2pL9vR4tY1wZ8nB6cD3fH5jK0aE"; // 31 chars
const VALID_URL = "postgresql://postgres:pw@localhost:5432/medcore";

function errs(env: { AUTH_SECRET?: string; DATABASE_URL?: string }): string[] {
  return productionEnvErrors(env);
}

describe("productionEnvErrors (Phase 29 env guard)", () => {
  it("accepts a well-formed production snapshot", () => {
    expect(
      errs({ AUTH_SECRET: `${STRONG_SECRET}g`, DATABASE_URL: VALID_URL })
    ).toEqual([]);
  });

  it("accepts a long random base64 secret (openssl rand -base64 32 output shape)", () => {
    expect(
      errs({
        AUTH_SECRET: "bXlzZWNyZXQtZm9yLXByb2R1Y3Rpb24tdXNlLWdlbi1yYW5kb20",
        DATABASE_URL: VALID_URL,
      })
    ).toEqual([]);
  });

  it("rejects a missing, empty, or whitespace-only AUTH_SECRET", () => {
    expect(errs({ DATABASE_URL: VALID_URL })).toEqual([
      "AUTH_SECRET is not set",
    ]);
    expect(errs({ AUTH_SECRET: "", DATABASE_URL: VALID_URL })).toEqual([
      "AUTH_SECRET is not set",
    ]);
    expect(errs({ AUTH_SECRET: "   ", DATABASE_URL: VALID_URL })).toEqual([
      "AUTH_SECRET is not set",
    ]);
  });

  it("rejects the .env.example placeholder secret (the core defect)", () => {
    const errors = errs({
      AUTH_SECRET: EXAMPLE_AUTH_SECRET,
      DATABASE_URL: VALID_URL,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("publicly known placeholder");
  });

  it("rejects the CI dummy secret — it is committed in .github/workflows", () => {
    const errors = errs({
      AUTH_SECRET: "ci-build-only-dummy-secret",
      DATABASE_URL: VALID_URL,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("publicly known placeholder");
  });

  it("rejects secrets shorter than 32 characters and enforces the boundary", () => {
    const short = errs({
      AUTH_SECRET: STRONG_SECRET, // 31
      DATABASE_URL: VALID_URL,
    });
    expect(short).toHaveLength(1);
    expect(short[0]).toContain("at least 32 characters");

    const boundary = errs({
      AUTH_SECRET: `${STRONG_SECRET}g`, // 32
      DATABASE_URL: VALID_URL,
    });
    expect(boundary).toEqual([]);
  });

  it("rejects a missing, placeholder, or non-postgres DATABASE_URL", () => {
    expect(errs({ AUTH_SECRET: `${STRONG_SECRET}g` })).toEqual([
      "DATABASE_URL is not set",
    ]);
    expect(
      errs({
        AUTH_SECRET: `${STRONG_SECRET}g`,
        DATABASE_URL: EXAMPLE_DATABASE_URL,
      })
    ).toEqual(["DATABASE_URL is the .env.example placeholder"]);
    expect(
      errs({
        AUTH_SECRET: `${STRONG_SECRET}g`,
        DATABASE_URL: "mysql://user:pw@dbhost/app",
      })
    ).toEqual(["DATABASE_URL must use the postgresql:// scheme"]);
    expect(
      errs({
        AUTH_SECRET: `${STRONG_SECRET}g`,
        DATABASE_URL: "not a url",
      })
    ).toEqual(["DATABASE_URL is not a valid URL"]);
    expect(
      errs({
        AUTH_SECRET: `${STRONG_SECRET}g`,
        DATABASE_URL: "postgresql://localhost:5432",
      })
    ).toEqual(["DATABASE_URL is missing a database name"]);
    expect(
      errs({
        AUTH_SECRET: `${STRONG_SECRET}g`,
        DATABASE_URL: "postgres://localhost:5432/app",
      })
    ).toEqual([]);
  });

  it("reports every violated rule at once", () => {
    expect(errs({})).toEqual([
      "AUTH_SECRET is not set",
      "DATABASE_URL is not set",
    ]);
  });
});

describe("assertProductionEnv (Phase 29 fail-fast)", () => {
  it("returns silently for a valid snapshot", () => {
    expect(() =>
      assertProductionEnv({
        AUTH_SECRET: `${STRONG_SECRET}g`,
        DATABASE_URL: VALID_URL,
      })
    ).not.toThrow();
  });

  it("throws a descriptive error for a placeholder secret", () => {
    expect(() =>
      assertProductionEnv({
        AUTH_SECRET: EXAMPLE_AUTH_SECRET,
        DATABASE_URL: VALID_URL,
      })
    ).toThrow(/\[env-guard\] refusing to start a production server/);
  });

  it("never echoes the secret value in the thrown message", () => {
    const weakButPrivate = "hunter2-too-short-but-private";
    let message = "";
    try {
      assertProductionEnv({
        AUTH_SECRET: weakButPrivate,
        DATABASE_URL: VALID_URL,
      });
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
      assertProductionEnv({
        AUTH_SECRET: `${STRONG_SECRET}g`,
        DATABASE_URL: "postgresl://user:SUPERSECRETpw@localhost/db",
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(
      "DATABASE_URL must use the postgresql:// scheme"
    );
    expect(message).not.toContain("SUPERSECRETpw");
  });
});

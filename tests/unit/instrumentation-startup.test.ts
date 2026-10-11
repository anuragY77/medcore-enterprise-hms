// Phase 30: subprocess regression tests for the REAL production startup
// path (src/instrumentation.ts), not just the pure validator.
//
// Unit tests of productionEnvRules prove the rules; these prove the wiring:
//   - register() runs only for NEXT_RUNTIME=nodejs + NODE_ENV=production;
//   - a rejected environment hard-exits the process (code 1) instead of
//     letting Next log the error and keep serving (verified on next@16.3.8:
//     an instrumentation throw leaves the server listening, answering 500);
//   - a valid environment returns cleanly (exit 0);
//   - error output names the broken rule but never echoes secret values.
//
// Each case runs `tsx <temp child>` in its own process so process.exit(1)
// can never take down the Vitest runner.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const instrumentationPath = fileURLToPath(
  new URL("../../src/instrumentation.ts", import.meta.url)
);

const VALID_SECRET = "phase30-subprocess-valid-secret-0123456789abcdef";
const CANARY_SECRET = "phase30-CANARY-secret-must-not-leak-abcdef1234567890";
const VALID_DB = "postgresql://postgres:pw@localhost:5432/medcore";
const VALID_AUTH_URL = "https://hms.example.com";

const childSource = [
  `import { register } from ${JSON.stringify(instrumentationPath)};`,
  `register().then(() => { process.exit(0); });`,
  ``,
].join("\n");

const childDir = mkdtempSync(join(tmpdir(), "p30-instr-"));
const childScript = join(childDir, "child.ts");
writeFileSync(childScript, childSource, "utf8");

/** Minimal env for the child: just enough for Node/tsx plus our vars. */
function childEnv(extra: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SYSTEMROOT: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    // Force the production code path; individual cases override per-var.
    NEXT_RUNTIME: "nodejs",
    NODE_ENV: "production",
    NEXT_PHASE: undefined,
  };
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete base[key];
    else base[key] = value;
  }
  return base;
}

function runChild(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [tsxCli, childScript], {
    env,
    encoding: "utf8",
    timeout: 60_000,
  });
}

describe("instrumentation register() subprocess behavior (Phase 30)", () => {
  it("hard-exits non-zero when AUTH_SECRET is a public placeholder", () => {
    const result = runChild(
      childEnv({
        AUTH_SECRET: "ci-build-only-dummy-secret",
        DATABASE_URL: VALID_DB,
        AUTH_URL: VALID_AUTH_URL,
      })
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[env-guard] refusing to start");
    expect(result.stderr).toContain("publicly known placeholder");
  }, 60_000);

  it("hard-exits non-zero when AUTH_URL and AUTH_TRUST_HOST are both unset (UntrustedHost defect)", () => {
    const result = runChild(
      childEnv({
        AUTH_SECRET: VALID_SECRET,
        DATABASE_URL: VALID_DB,
        AUTH_URL: undefined,
        AUTH_TRUST_HOST: undefined,
      })
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("UntrustedHost");
    expect(result.stderr).toContain("AUTH_URL");
  }, 60_000);

  it("never echoes secret or database credential values in the failure output", () => {
    const result = runChild(
      childEnv({
        AUTH_SECRET: CANARY_SECRET, // valid length, but AUTH_URL missing
        DATABASE_URL: "postgresql://user:DBCANARYpw@localhost:5432/medcore",
        AUTH_URL: undefined,
        AUTH_TRUST_HOST: undefined,
      })
    );
    expect(result.status).toBe(1);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain("[env-guard]");
    expect(output).not.toContain(CANARY_SECRET);
    expect(output).not.toContain("DBCANARYpw");
  }, 60_000);

  it("exits 0 when the production environment is valid", () => {
    const result = runChild(
      childEnv({
        AUTH_SECRET: VALID_SECRET,
        DATABASE_URL: VALID_DB,
        AUTH_URL: VALID_AUTH_URL,
      })
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 60_000);

  it("exits 0 with an empty environment outside production (NODE_ENV=test)", () => {
    const result = runChild(
      childEnv({
        NODE_ENV: "test",
        NEXT_RUNTIME: "nodejs",
        AUTH_SECRET: undefined,
        DATABASE_URL: undefined,
        AUTH_URL: undefined,
      })
    );
    expect(result.status).toBe(0);
  }, 60_000);

  it("skips validation outside the Node runtime (NEXT_RUNTIME=edge)", () => {
    const result = runChild(
      childEnv({
        NEXT_RUNTIME: "edge",
        AUTH_SECRET: undefined,
        DATABASE_URL: undefined,
        AUTH_URL: undefined,
      })
    );
    expect(result.status).toBe(0);
  }, 60_000);
});

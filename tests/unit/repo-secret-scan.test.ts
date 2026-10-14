import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isForbiddenTrackedPath,
  scanContent,
  sha1hex,
  SECRET_LITERAL_FP,
  URL_PASSWORD_FP,
} from "../../scripts/repo-secret-scan.mjs";

const RULES = (findings: Array<{ rule: string }>) => findings.map((f) => f.rule);

describe("scanContent: catches representative fake credential patterns", () => {
  it("flags a private key block", () => {
    const fakeKey = ["-----BEGIN RSA PRIVATE ", "KEY-----"].join("");
    const findings = scanContent(`const k = \`${fakeKey}\nabc\n-----END RSA PRIVATE KEY-----\``, "a.ts");
    expect(RULES(findings)).toContain("R1");
    expect(findings[0].category).toBe("private-key");
  });

  it("flags an AWS access key id shape", () => {
    const fake = ["AKIA", "ABCDEFGH12345678"].join("");
    const findings = scanContent(`const x = "${fake}";`, "a.ts");
    expect(RULES(findings)).toContain("R2");
    expect(findings[0].category).toBe("aws-access-key");
  });

  it("flags a GitHub fine-grained PAT shape", () => {
    const fake = ["github_pat_", "abcdef1234567890ABCDEF1234567890abcd"].join("");
    const findings = scanContent(`token=${fake}`, "a.ts");
    expect(RULES(findings)).toContain("R2");
    expect(findings[0].category).toBe("github-pat");
  });

  it("flags a JWT shape", () => {
    const fake = ["eyJhbGciOiJIUzI1NiJ9.", "eyJzdWIiOiIxMjM0NTY3ODkwIn0"].join("");
    const findings = scanContent(`assert(${fake}.signature)`, "a.ts");
    expect(RULES(findings)).toContain("R2");
    expect(findings[0].category).toBe("jwt");
  });

  it("flags a credential-bearing DB URL whose password is not a published placeholder", () => {
    const password = ["Sup3r", "S3cret-", "value!"].join("");
    const url = `postgresql://dbadmin:${password}@db.internal:5432/medcore`;
    const findings = scanContent(`const u = "${url}";`, "a.ts");
    expect(RULES(findings)).toContain("R3");
    expect(findings[0].category).toBe("db-infra-credential");
  });

  it("flags a quoted secret assignment that is not published", () => {
    const value = ["runtime", "-signing-", "secret-9f2b"].join("");
    const findings = scanContent(`AUTH_SECRET = "${value}"`, "a.ts");
    expect(RULES(findings)).toContain("R4");
    expect(findings[0].category).toBe("secret-assignment");
  });

  it("flags ??= quoted secret assignments too", () => {
    const value = ["fallback", "session", "secret-44de"].join("");
    const findings = scanContent(`process.env.AUTH_SECRET ??= "${value}";`, "a.ts");
    expect(RULES(findings)).toContain("R4");
  });

  it("flags a YAML bare secret assignment", () => {
    const value = ["workflow", "only", "secret-81aa"].join("");
    const findings = scanContent(`      JWT_SECRET: ${value}\n`, "w.yml");
    expect(RULES(findings)).toContain("R4");
  });

  it("ignores env-interpolated values instead of guessing", () => {
    const findings = scanContent(
      `const u = "postgresql://u:\${DB_PASSWORD}@h:5432/d";\nAUTH_SECRET = process.env.AUTH_SECRET;`,
      "a.ts"
    );
    expect(findings).toEqual([]);
  });
});

describe("scanContent: does not flag published placeholders", () => {
  it("accepts the real .env.example placeholder values", () => {
    const content = readFileSync(".env.example", "utf8");
    expect(scanContent(content, ".env.example")).toEqual([]);
    expect(isForbiddenTrackedPath(".env.example")).toBeNull();
  });

  it("accepts the real CI workflow synthetic values", () => {
    const content = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(scanContent(content, ".github/workflows/ci.yml")).toEqual([]);
  });

  it("accepts every published URL-password and secret literal fingerprint", () => {
    for (const fp of URL_PASSWORD_FP) expect(fp).toMatch(/^[0-9a-f]{40}$/);
    for (const fp of SECRET_LITERAL_FP) expect(fp).toMatch(/^[0-9a-f]{40}$/);
    expect(URL_PASSWORD_FP.has(sha1hex("pw"))).toBe(true);
    expect(URL_PASSWORD_FP.has(sha1hex("postgres"))).toBe(true);
    expect(SECRET_LITERAL_FP.has(sha1hex("ci-build-only-dummy-secret"))).toBe(true);
    expect(URL_PASSWORD_FP.has(sha1hex("definitely-not-a-placeholder-9x"))).toBe(false);
  });

  it("skips whitespace-only secret fixtures", () => {
    expect(scanContent(`AUTH_SECRET: "   "`, "a.ts")).toEqual([]);
  });
});

describe("isForbiddenTrackedPath: local-only files must never be tracked", () => {
  it.each([
    [".env", "env-file"],
    [".env.local", "env-file"],
    [".env.production", "env-file"],
    ["config/.env.staging", "env-file"],
    ["backups/nightly.dump", "backup-artifact"],
    ["db.sql.gz", "backup-artifact"],
    ["Architecture.md", "private-doc"],
    ["docs/Architecture.md", "private-doc"],
    ["PRD.md", "private-doc"],
    ["docs/Memory.md", "private-doc"],
    ["notes/Memory.md", "private-doc"],
    ["Memory.md", "private-doc"],
    ["client.key", "key-material"],
    ["certs/server.pem", "key-material"],
    ["data/patients.db", "local-database"],
    ["next.log", "log-file"],
  ])("flags %s as %s", (path, category) => {
    const hit = isForbiddenTrackedPath(path);
    expect(hit).not.toBeNull();
    expect(hit?.[1]).toBe(category);
  });

  it.each([
    ".env.example",
    "README.md",
    "docs/clinical-data-lifecycle-decision-record.md",
    "drizzle/migrations/0001_reflective_silvermane.sql",
    "scripts/repo-secret-scan.mjs",
    "src/lib/instrumentation.ts",
  ])("allows %s", (path) => {
    expect(isForbiddenTrackedPath(path)).toBeNull();
  });
});

describe("repository hygiene regression", () => {
  it(".gitignore keeps protecting local-only files (and never .env.example)", () => {
    const ign = readFileSync(".gitignore", "utf8");
    for (const line of [".env*", "!.env.example", "*.dump", "*.sql.gz", "*.backup", "docs/Memory.md", "*.db", "*.key"]) {
      expect(ign).toContain(line);
    }
    const check = (target: string) => {
      try {
        execFileSync("git", ["check-ignore", "-q", target], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    };
    expect(check(".env.local")).toBe(true);
    expect(check("docs/Memory.md")).toBe(true);
    expect(check(".env.example")).toBe(false);
    expect(check("drizzle/migrations/0001_reflective_silvermane.sql")).toBe(false);
  });

  it("the tracked tree scans clean with exit code 0", () => {
    const out = execFileSync(process.execPath, ["scripts/repo-secret-scan.mjs"], {
      encoding: "utf8",
    });
    expect(out).toContain("FINDINGS=0");
  });

  it("CLI exits 1 on a finding and never prints the matched value", () => {
    const dir = mkdtempSync(join(tmpdir(), "scan-fixture-"));
    try {
      const password = ["Rot4ted", "but", "found-77c"].join("");
      const file = join(dir, "fixture.txt");
      writeFileSync(file, `postgresql://admin:${password}@host:5432/db\n`);
      let stdout = "";
      let code = 0;
      try {
        stdout = execFileSync(
          process.execPath,
          ["scripts/repo-secret-scan.mjs", "--paths", file],
          { encoding: "utf8" }
        );
      } catch (error) {
        const err = error as { status?: number; stdout?: string };
        code = err.status ?? -1;
        stdout = err.stdout ?? "";
      }
      expect(code).toBe(1);
      expect(stdout).toContain(":R3:db-infra-credential");
      expect(stdout).not.toContain(password);
      expect(stdout).not.toContain("admin");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("history mode (--rev) scans the rewritten main branch clean", () => {
    const out = execFileSync(
      process.execPath,
      ["scripts/repo-secret-scan.mjs", "--rev", "main"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    expect(out).toContain("FINDINGS=0");
  });

  it("history mode exits 1 on a synthetic commit holding a fake credential, without printing it", () => {
    const dir = mkdtempSync(join(tmpdir(), "scan-history-"));
    try {
      const password = ["History", "leak-", "fixture-", "b3e1"].join("");
      execFileSync("git", ["init", "-q", dir]);
      const git = (args: string[]) =>
        execFileSync("git", args, { cwd: dir, stdio: "ignore" });
      git(["config", "user.email", "scan-fixture@example.invalid"]);
      git(["config", "user.name", "scan-fixture"]);
      writeFileSync(
        join(dir, "notes.txt"),
        `postgresql://svc:${password}@db.internal:5432/medcore\n`
      );
      git(["add", "notes.txt"]);
      git(["commit", "-q", "-m", "fixture"]);
      let stdout = "";
      let code = 0;
      try {
        stdout = execFileSync(
          process.execPath,
          [join(process.cwd(), "scripts", "repo-secret-scan.mjs"), "--rev", "HEAD"],
          { cwd: dir, encoding: "utf8" }
        );
      } catch (error) {
        const err = error as { status?: number; stdout?: string };
        code = err.status ?? -1;
        stdout = err.stdout ?? "";
      }
      expect(code).toBe(1);
      expect(stdout).toContain(":R3:db-infra-credential");
      expect(stdout).not.toContain(password);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Phase 27 (residual D): auth.ts must not write user emails to console logs.
//
// The invalid-role branch in the credentials authorize callback previously
// logged `${user.email}`, leaking account PII into server logs. It now logs
// the opaque user id. These tests fail if the email (or any raw login
// identifier) is reintroduced into auth.ts console output.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../../src/lib/auth.ts", import.meta.url)),
  "utf8"
);

const CONSOLE_LINE = /console\.(log|info|warn|error|debug)\(/;

describe("auth.ts console output redaction", () => {
  it("scan is not vacuous (auth.ts contains a console statement)", () => {
    expect(source).toMatch(CONSOLE_LINE);
  });

  it("logs the invalid role against the opaque user id, not the email", () => {
    expect(source).toMatch(/Invalid role "[^"]+" for user \$\{user\.id\}/);
    expect(source).not.toMatch(/Invalid role "[^"]+" for user \$\{user\.email\}/);
  });

  it("never interpolates user.email into any console statement", () => {
    const consoleLines = source
      .split("\n")
      .filter((line) => CONSOLE_LINE.test(line));
    expect(consoleLines.length).toBeGreaterThan(0);
    for (const line of consoleLines) {
      expect(line).not.toMatch(/user\.email/);
      expect(line).not.toMatch(/\bemail\b[^"`]*\$\{/);
    }
  });
});

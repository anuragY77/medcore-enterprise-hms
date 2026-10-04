import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal .env.local loader for the seed CLI (tsx does not load Next.js
 * env files itself). Values already present in process.env are never
 * overwritten. Values are not logged anywhere.
 */
export function loadLocalEnv(rootDir: string): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(rootDir, ".env.local"), "utf8");
  } catch {
    return; // No .env.local — rely on the ambient environment.
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

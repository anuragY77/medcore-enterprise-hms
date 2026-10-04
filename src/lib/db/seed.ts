import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";
import { loadLocalEnv } from "./seed/env";
import { assertSeedTarget, SeedGuardError } from "./seed/guard";
import { seedAll } from "./seed/index";
import type { SeedCounts } from "./seed/types";

/**
 * Demo-data seed CLI.
 *
 * Safety model (all enforced before any connection opens):
 *   1. Explicit confirmation: the `--demo` flag or SEED_DEMO_DATA=1.
 *   2. NODE_ENV must be development or test (never production).
 *   3. The target must be a parseable postgres URL on loopback, with a
 *      non-production-like database name (see seed/guard.ts).
 * The run itself is one transaction: any failure rolls the whole seed back.
 * Only upserts run — no DELETE, TRUNCATE or DDL.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const confirmed =
    args.includes("--demo") || process.env.SEED_DEMO_DATA === "1";

  loadLocalEnv(fileURLToPath(new URL("../../../", import.meta.url)));

  const target = assertSeedTarget({
    databaseUrl: process.env.DATABASE_URL,
    nodeName: process.env.NODE_ENV,
    confirmed,
  });

  console.log(
    `Seeding demo data into "${target.database}" @ ${target.host} ` +
      `(NODE_ENV=${process.env.NODE_ENV})`
  );

  const db = drizzle(process.env.DATABASE_URL!, { schema });
  const counts: SeedCounts = await db.transaction((tx) => seedAll(tx));

  console.log("\nSeeded (upserted) rows by domain:");
  let total = 0;
  for (const [domain, n] of Object.entries(counts)) {
    total += n;
    console.log(`  ${domain.padEnd(22)} ${n}`);
  }
  console.log(`  ${"TOTAL".padEnd(22)} ${total}`);
  console.log(
    "\nDone. Re-running is safe: identifiers are stable, so repeat runs " +
      "update the same rows instead of duplicating them."
  );
}

main().catch((error: unknown) => {
  if (error instanceof SeedGuardError) {
    console.error(`Seed refused: ${error.message}`);
  } else {
    console.error("Seed failed and was rolled back:", error);
  }
  process.exit(1);
});

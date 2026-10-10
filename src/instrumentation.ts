// Phase 29: fail fast when a production SERVER boots with missing or
// placeholder credentials (see src/lib/env-guard.ts for the rules).
//
// Next invokes `register()` once per server instance — `next dev` and
// `next start`. The three guards below scope it to a real production boot:
//   - NEXT_RUNTIME: only the Node.js runtime (no edge/worker side effects);
//   - NODE_ENV: dev servers and the Vitest suite (NODE_ENV=test) skip;
//   - NEXT_PHASE: belt-and-suspenders against `next build` ever executing
//     instrumentation (verified NOT to happen on next@16.3.8 — a build with
//     the public CI dummy secret passes even with this line removed — but
//     Next's behavior has varied across versions, and a build must never
//     require deployment credentials).
// Validation runs before any request is served, so a misconfigured deploy
// dies with a clear [env-guard] error instead of silently signing sessions
// with an example secret.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  try {
    const { assertProductionEnv } = await import("./lib/env-guard");
    assertProductionEnv();
  } catch (error) {
    // Next catches instrumentation errors, logs them, and KEEPS SERVING
    // (verified on next@16.3.8: a placeholder AUTH_SECRET produces the
    // [env-guard] error plus "Failed to prepare server", yet the process
    // stays listening and answers /login with 500 forever). A misconfigured
    // production deploy must not accept traffic at all — abort hard with a
    // non-zero exit so the supervisor shows a crash instead of a zombie.
    console.error(
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

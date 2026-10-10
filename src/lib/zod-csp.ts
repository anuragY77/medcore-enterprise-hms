/**
 * Phase 28 — CSP compatibility for Zod v4.
 *
 * Zod v4's object-schema constructor runs a JIT capability probe
 * (`new Function("")`, wrapped in try/catch — see node_modules/zod/v4/core/util.js
 * `allowsEval`) the first time an object schema is constructed. Under the
 * Phase 28 Content-Security-Policy (`script-src 'self' 'unsafe-inline'`, no
 * `unsafe-eval`) the blocked probe still throws and is caught, so parsing
 * keeps working — but the browser logs a `securitypolicyviolation` / console
 * error on every page load, and Zod ships their own guidance for exactly this
 * case: set `jitless` so the probe is skipped entirely.
 *
 * `jitless: true` disables Zod's compiled (eval-based) fast path in favour of
 * the interpreted parser. Behaviour is identical; throughput differences are
 * irrelevant for form/API payloads. Applied globally on server and client so
 * both runtimes parse the same way.
 *
 * This module must be imported BEFORE the first `z.object(...)` runs in a
 * runtime. It is therefore the first import of:
 *   - src/app/layout.tsx (every page, incl. (auth) pages + next-auth client)
 *   - every src/lib/validations/*.ts module (all schema construction sites)
 * The assignment is written to work whether it runs before or after zod's own
 * core module initialises `globalThis.__zod_globalConfig` (zod uses `??=`, so
 * whichever module runs first creates the object and the other mutates it).
 */
import { z } from "zod";

z.config({ jitless: true });

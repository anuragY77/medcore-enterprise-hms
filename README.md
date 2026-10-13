<div align="center">

# 🏥 MedCore Enterprise

### The Hospital Management System — built like a product, not a project.

**A production-grade, full-stack HMS with real workflows — authentication, RBAC, clinical records, billing & insurance, pharmacy, lab, surgery, emergency, and a live inpatient bed lifecycle.**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-Private-ff5757)

</div>

---

## 📊 At a Glance

<div align="center">

| | | | | |
|:--:|:--:|:--:|:--:|:--:|
| **20** | **54** | **32** | **25** | **9** |
| [Modules](#modules) | API Routes | Pages | DB Tables | RBAC Roles |
| **81** | **42** | **1,549** | **0** |
| Components | Permission Keys | Automated Checks | Build Errors |

</div>

---

## 🎯 Why MedCore?

Most portfolio HMS projects stop at CRUD screens with fake data. MedCore goes further:

- **🔒 Real security** — every API is authenticated and permission-checked server-side; UI gating is a convenience, the backend is the source of truth.
- **🔁 Real workflows** — admit → assign bed → occupy → transfer → discharge → release, with transactional integrity, deadlock-safe locking, and audit trails.
- **🧾 Real billing** — invoices, payments, insurance claims, approvals — computed from actual line items, never hard-coded.
- **🧪 Really tested** — 1,549 automated checks across 17 regression suites (API contracts, RBAC matrices, DB integrity, concurrency races, notification delivery, static source gates), plus strict `tsc`, ESLint, and production build gates. The suites run from a local harness outside this repository; the committed gates are `tsc`, lint, the committed Vitest test suite (460 tests across 36 files), and build — the same four gates wired into CI for every push and pull request.
- **🚫 Zero fake data in the UI** — dashboards, ward views, and shift summaries are computed from live queries.

---

## 🧰 Tech Stack

| Layer | Choice |
|-------|--------|
| **Framework** | Next.js 16 (App Router, Server Actions, route handlers) |
| **Language** | TypeScript 5 (strict, `tsc --noEmit` gate) |
| **Styling** | Tailwind CSS v4 + Radix UI primitives |
| **State** | Zustand + TanStack Query |
| **Forms** | React Hook Form + Zod 4 (shared client/server schemas) |
| **Database** | PostgreSQL 18 + Drizzle ORM (type-safe queries, migrations) |
| **Auth** | NextAuth v5 — Credentials provider, JWT sessions, RBAC middleware |
| **Charts** | Recharts |
| **Icons** | Lucide React |

---

## 🗂️ Modules

<details open>
<summary><b>Click to explore all 20 modules</b></summary>

<br>

| # | Module | What it does |
|:-:|--------|--------------|
| 1 | 📊 **Dashboard** | Live KPIs, department status, activity timeline, admissions analytics |
| 2 | 👤 **Patients** | Registry, profiles, allergies, conditions, medications, full records hub |
| 3 | 🩺 **Clinical** | Consultations, prescriptions, vitals, medical records — linked to patient charts |
| 4 | 👨‍⚕️ **Staff** | Doctors & staff directory, departments |
| 5 | 📅 **Appointments** | Scheduling, status lifecycle, doctor assignment |
| 6 | 🛏️ **Beds & Rooms** | **Inpatient lifecycle: admission → assignment → occupancy → transfer → discharge → release** |
| 7 | 💗 **Nursing** | Ward patient board, task queue, live shift metrics, quick actions |
| 8 | 💊 **Pharmacy** | Inventory, prescriptions, dispensing workflow |
| 9 | 🧪 **Laboratory** | Orders, results, processing → completion pipeline |
| 10 | 🔬 **Surgery** | OT scheduling, procedure planning |
| 11 | 🚨 **Emergency** | Triage, acuity levels, command center |
| 12 | 💳 **Billing** | Invoices, line items, payments, totals |
| 13 | 🛡️ **Insurance** | Claims, approval workflow, coverage |
| 14 | 📦 **Inventory** | Stock tracking, levels, alerts |
| 15 | 📁 **Records** | Cross-patient records hub with relational details |
| 16 | 🔔 **Notifications** | Per-user inbox with live topbar bell (unread badge) |
| 17 | 📈 **Reports** | Aggregated operational reporting |
| 18 | 🕵️ **Audit Log** | Immutable security audit trail with actor/action/category |
| 19 | 👥 **Users & Roles** | Account management, role assignment |
| 20 | ⚙️ **Settings** | System configuration |

</details>

---

## 🔐 Role-Based Access Control

Nine roles, **41 permission keys**, enforced on every endpoint:

| Role | Typical Access |
|------|----------------|
| 🛡️ **Administrator** | Everything — full control |
| 🩺 **Doctor** | Patients, clinical, appointments, labs, pharmacy, records |
| 💗 **Nurse** | Patients, nursing, beds (read), vitals, ward board |
| 🙋 **Receptionist** | Patient registration, appointments, admissions desk |
| 💊 **Pharmacist** | Pharmacy, inventory, prescriptions |
| 🧪 **Lab Technician** | Laboratory, results |
| 💳 **Billing** | Invoices, insurance, claims |
| 🔪 **Surgeon** | Surgery, patients (read), records |
| 🔒 **Security** | Audit log, read-only oversight |

```ts
// One shared source of truth — server + client
hasPermission(session.user.role, "beds:write")   // ADMIN only
hasPermission(session.user.role, "patients:read") // 5 roles
```

---

## 🔄 Inpatient Bed Lifecycle — the flagship workflow

Admission, occupancy, and discharge are **transactional and audited** — not a status dropdown:

```mermaid
flowchart LR
    A[🧑 Patient] --> B[📝 Admission<br/>department + doctor<br/>audit: patient.admit]
    B --> C[🛏️ Assign Bed<br/>POST /assign<br/>audit: bed.assign]
    C --> D[🏠 Occupied<br/>beds.patient_id set<br/>invariant enforced]
    D --> T[🔁 Transfer<br/>POST /transfer — one TX<br/>audit: patient.transfer]
    T --> D2[🏠 Occupied elsewhere<br/>old bed Available<br/>new bed Occupied]
    D2 -.->|reusable| T
    D --> E[📤 Discharge<br/>status = Discharged<br/>audit: patient.discharge]
    E --> F[✅ Available<br/>bed released in same TX<br/>audit: bed.release]
    F -.->|reusable| C
```

**Guarantees:**
- ♟️ **Deadlock-safe** — consistent lock order: patient row → bed row
- 🚫 **Double-booking impossible** — concurrent assign races resolve to exactly one `200` + one `409`
- 🚫 **One admission per patient** — a second admit while occupying a bed or still admitted → `409`; readmission allowed after discharge
- 🧹 **No orphaned beds** — deleting a patient releases their held bed(s) in the same transaction
- 📏 **Single source of truth** — `beds.patient_id` ⇄ `beds.status` consistency validated in every write path
- 📜 **Append-only audit** — safe identifiers only, never clinical text; every occupancy change emits `bed.assign` / `bed.release` / `patient.transfer`
- ⚖️ **Occupancy cannot be overwritten** via generic `PUT` — workflow endpoints only
- 🔁 **Transfer is atomic** — one transaction frees the source bed and occupies the destination (locks patient first, then both beds by ascending id); concurrent transfers of the same patient or into the same bed resolve to exactly one `200`
- 📨 **Right people notified** — admit/discharge → attending doctor; assign/release (including on patient delete) → ward nurses of the bed's department; transfer → ward nurses of both departments

### One transaction per state change

```mermaid
sequenceDiagram
    participant UI as Client / UI
    participant API as API route (RBAC + Zod)
    participant DB as PostgreSQL
    participant AUD as audit_logs
    participant N as Notifications

    UI->>API: POST /api/patients/:id/admission
    API->>DB: BEGIN, lock patient (FOR UPDATE)
    alt already admitted or occupying a bed
        API-->>UI: 409 Conflict, zero writes, zero side effects
    else eligible
        API->>DB: insert Admission record, status = Active
        API->>AUD: patient.admit (same transaction — safe IDs only)
        API->>DB: COMMIT
        API->>N: attending-doctor notification
        API-->>UI: 200 OK
    end
```

Failed guards return before any write — no audit rows, no notifications, no partial state. The same pattern covers assign, release, transfer, discharge, and patient delete.

### Audit semantics, integrity & lifecycle (Phases 32–33)

- **Same-transaction audit** — **every one of the 19 transactional mutation routes** writes its audit rows **inside the mutation transaction** via `insertAuditRow` (`src/lib/audit.ts`): the 11 clinical routes from Phase 32 (patient admission/discharge/transfer/delete, bed assign/release, lab process/complete, prescription dispense, consultation start) plus Phase 33's financial/destructive conversions (billing invoice update & delete, insurance claim create & update, occupied-bed create, and the user/staff/appointment deletes — the last three wrapped in a transaction where none existed, so a delete whose audit cannot be recorded leaves the row intact). A rollback discards the audit row with the clinical write, and an audit-write failure fails the whole transaction (a mutation whose trail cannot be recorded is rejected, never committed blind). `tests/integration/audit-reliability.test.ts` proves the guarantee against real PostgreSQL for clinical (dispense, lab complete, patient delete) and financial/destructive paths (invoice update/delete, claim update, user delete, occupied-bed create) via fault injection: injected audit failure → 500 with zero partial state, clean retry → success with exactly one audit row.
- **Best-effort residual paths** — operations that legitimately commit outside a transaction (credentials sign-in audits in `src/lib/auth.ts`; simple non-transactional creates/updates — patients, appointments, staff, users, departments, inventory, pharmacy, lab, emergency, surgery, notification writes, and available-bed creates) keep the non-throwing `recordAudit` wrapper; a failed insert is logged (action + entity type only, never metadata values) and counted in-process. Phase 33 also closed an omission: available-bed creates now emit a best-effort `bed.create` audit (previously unlogged). The counter is exposed as `auditWriteFailures` on `GET /api/health` **only** to sessions holding the existing `audit:read` key (ADMIN/SECURITY); it resets on process restart by design and is an operational signal, not an audit substitute.
- **Append-only by construction** — the application exposes no UPDATE or DELETE endpoint on `audit_logs`; the only write path is the INSERT helper. Database-level: `actor_id` references `users(id)` with RESTRICT (a deleted user's audit rows are never orphaned or silently re-attributed — user deletion correctly 409s), and three indexes support the security-read access patterns. `entity_id` deliberately carries no FK so audit rows about a deleted entity survive the entity's removal. A database-trigger proposal for hard append-only enforcement is documented (not deployed) as decision 6 in the lifecycle decision record — it stays undeployed until the retention decision answers how maintenance deletes would ever run.
- **Lifecycle limits (honesty note)** — `DELETE /api/patients/[id]` hard-cascades 13 clinical child tables (allergies, conditions, medications, consultations, prescriptions, medical records, vitals, appointments, lab tests, invoices, insurance claims, emergency cases, surgeries; beds are SET NULL via a pre-released bed in the same transaction) while audit rows survive; Phase 33 verifies this full cascade inventory against real rows (one seeded row per child table, all erased; notifications — user-scoped, no patient FK — untouched). **No retention policy is implemented or asserted** — retention, deletion-rights handling, and audit-immutability trade-offs are owner decisions captured as an open decision record (`docs/clinical-data-lifecycle-decision-record.md`), not engineering defaults.
- **Health endpoint** — `GET /api/health` returns liveness + database readiness (`SELECT 1`) with `Cache-Control: no-store`, never leaks secrets/stack/URLs, and is anonymous-safe (auth failure is treated as an anonymous session; the counter field is omitted without `audit:read`). It exists for operators and the deployment boundary; it is not a compliance signal.

---

## 🔒 Security & Hardening

- **Brute-force login protection** — every credentials sign-in attempt passes through a PostgreSQL-backed rate limiter (`src/lib/login-rate-limit.ts`) before NextAuth runs. Repeated failures within a rolling window temporarily throttle the attempt (keyed by client + account, with a separate source-only key when the account field is unreadable or too long to store safely); a successful sign-in clears the keys, and blocks are always temporary — never permanent — so a legitimate user can never be locked out for long. Exact thresholds are internal policy and deliberately undocumented. If the limiter's own database access fails it **fails open** (login proceeds, error logged — genuine outages and possible defects are logged distinctly, so a bug cannot hide behind "the database was down"), because a database outage must never keep clinicians out of the hospital system. Responses stay generic — the UI never reveals whether an account exists. **Client-address trust**: the source IP is taken from the *last* `x-forwarded-for` entry — the one appended by the nearest proxy; a client-supplied prefix to its left is ignored — so deploy behind a reverse proxy that **overwrites** `x-forwarded-for`. On a directly exposed server that header is client-controlled and IP keying degrades accordingly; header tokens are validated as literal IPv4/IPv6 addresses, so a garbage header can only ever produce the shared `unknown` key, never an unbounded one.
- **Explicit session lifetime** — sessions are JWTs with a **12-hour absolute lifetime** (`src/lib/session-config.ts`), enforced at every session read: the sign-in timestamp (`authAt` claim) is pinned once and never extended, so ordinary activity — including repeated `/api/auth/session` refreshes from the polling UI — cannot slide expiry; tokens past the limit are rejected and the cookie cleared (tokens minted before the claim existed adopt their own `iat`). Auth redirects are pinned to the configured `AUTH_URL` origin rather than a request-supplied Host, which doubles as a Host-header redirect-poisoning defense — set `AUTH_URL` to the deployment's real public origin.
- **Server-side idle timeout** — in addition to the absolute lifetime, sessions expire after a configurable inactivity window (default **15 minutes**, `SESSION_IDLE_TIMEOUT_MINUTES`, validated to 1–480 minutes; an invalid value logs a warning and falls back to the default rather than crashing startup). **Activity means real user input only**: page/RSC navigations (`src/proxy.ts`, prefetches skipped) and input-driven pings to `POST /api/auth/activity` from `src/components/auth/session-activity-monitor.tsx`. Background `/api/auth/session` polls and badge refreshes are structurally excluded from recording, and idle state lives in PostgreSQL (`session_activity`, migration `0012`, keyed by a stable per-login `sid` JWT claim — never a claim re-stamped by Auth.js's re-encode on every session read), so polling can never slide the idle clock. Enforcement runs inside the wrapped `auth()` used by middleware, every API route, and the `/api/auth/session` response, with all time comparisons performed **in the database** (`now()` vs `last_activity`) — no JS/DB timestamp arithmetic. Policy is **fail-closed**: if the activity store is unavailable the request is rejected and logged (outage vs defect classified; login-time pruning is best-effort and never blocks sign-in). Idle expiry never extends or shortens the absolute lifetime — both checks pass or the session is rejected — and each expiry is audited exactly once (`auth.session_idle_expired`). Because enforcement is server-side, the client countdown (warning banner shown at 20% of the window remaining, lead time delivered by the server in the session payload) is purely informational: discovery happens on the next navigation or ping, which redirect to `/login?error=SessionExpired`.
- **Sign-out is terminal** — Auth.js JWT sessions are stateless, so signing out only clears the cookie: a session poll in flight from another tab could re-issue the still-valid token *after* the clear and resurrect the "logged out" session (a race reproduced intermittently by the Phase 20 browser probes). `POST /api/auth/signout` therefore also **tombstones** the session's `session_activity` row (epoch `last_activity`, `expired_logged` pre-flipped), and activity recording (`recordSessionActivity`) refuses to refresh any finalized sid — so the resurrected token fails the liveness gate on its very next request or navigation instead of resuming a live session. The tombstone is best-effort (sign-out must succeed during a store outage, and liveness already fails closed while the store is unreachable) and the pre-flipped flag means the forced rejection emits no spurious idle-expiry audit.
- **Safe login redirects** — the login page's `callbackUrl` parameter is sanitized (`src/lib/safe-redirect.ts`): only same-origin absolute paths are honored, protocol-relative (`//evil.example`, `/\evil.example`) and control-character payloads are rejected, so a crafted login link can never bounce an authenticated user (or their credentials form action flow) to an attacker origin. Every other `callbackUrl` in the app is a path the server itself produced.
- **Cross-origin auth POSTs rejected** — `POST /api/auth/*` (credentials callback, sign-out, CSRF) accepts requests only when a presented `Origin` header matches `AUTH_URL` (or the request URL when `AUTH_URL` is unset); unparseable origins — including the literal `null` from sandboxed documents — and foreign origins get `403` before any auth work runs, and requests with no `Origin` (server-to-server) pass through. Auth.js (5.0.0-beta.32) would otherwise mint a full session for a foreign-`Origin` credentials callback that carries a valid CSRF token (reproduced in Phase 23); the double-submit token and `SameSite=Lax` cookies blunted this in a browser, but the trust boundary no longer depends on their absence. Same policy as `POST /api/auth/activity`.
- **Dashboard data scoping** — `GET /api/dashboard/stats` returns invoice totals only to roles holding `billing:read` (ADMIN, RECEPTIONIST, BILLING; others get `null` and the Billing Summary card is hidden) and the audit-derived activity feed only to roles holding `audit:read` (ADMIN, SECURITY; others get an empty timeline). All other blocks are non-identifying operational counts shared by every signed-in role.
- **Report financial scoping** — `GET /api/reports` gates its `financial` block on the same `billing:read` rule (via `dashboardVisibility()`), so roles holding `reports:read` but not `billing:read` (DOCTOR, LAB_TECHNICIAN) receive `null` and the reports page hides the invoice/claim cards and the Billing / Insurance section.
- **Server-authoritative clinical attribution** — prescriptions, medical records, vitals, and consultations persist the authenticated session's name (`prescribedBy` / `recordedBy` / `doctorName`); the client-supplied name is never stored, so no record can be attributed to a clinician who did not author it. Record and vitals creates are audit-logged (`medical_record.create`, `vital.create`) alongside the existing prescription/consultation entries.
- **Validated patient intake, workflow-owned status** — `POST /api/patients` applies the full `patientSchema` server-side (gender/status enums, length caps, required fields — the create form already uses the same schema as its zodResolver), then verifies `department` and `attendingDoctor` against the live directory (`GET /api/reference`, gated `patients:write`: active departments + active `Dr. …` staff of role Doctor/Surgeon, names only — no ids or emails), so a stale or fabricated option (the pre-Phase-28 form hard-coded ten department names, five of which exist nowhere in the database) is rejected with a field-level 400 and nothing is written; `PUT /api/patients/[id]` rejects any explicit `status` key (transitions belong to the admission/discharge endpoints, which run bed bookkeeping and per-transition audits, and the partial schema's `status` default is stripped so profile edits can never write the column), and list pagination is bounded (`pageSize ≤ 100`, `page ≤ 100000`).
- **Baseline security headers** — every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-XSS-Protection: 0`, no `X-Powered-By`, and a **restrictive CSP** — `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'` (`ws:`/`wss:` added to `connect-src` in dev so HMR survives) plus `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` (`next.config.ts`). Phase 28 moved this from the script/style-silent "safe subset" to full coverage: `default-src` confines images/fonts/connect/media/workers to same-origin (the app renders no `<img>`, self-hosts its fonts via `next/font`, and fetches only same-origin APIs), `script-src` blocks cross-origin script loads and — deliberately without `'unsafe-eval'` — blocks `eval`/`new Function`, and `'unsafe-inline'` remains only as long as Next's inline bootstrap requires it — every page ships two inline `self.__next_f` flight scripts that nonce-only enforcement would block. A nonce requires per-request HTML, and all routes are build-time prerendered: Next documents that combination as incompatible with nonces (maintainers closed vercel/next.js#95433 and #96063 as expected behavior for static routes). The framework-side gap — boundary `loading`/`template`/`error` chunk tags emitted without the nonce — was fixed upstream in vercel/next.js#98398 (merged 2026-09-09, backported to the 16.3.x line; `nonce: ctx.nonce` present in the installed 16.3.8), leaving exactly one blocker: converting the static shells to dynamic rendering — an architectural decision deferred past this phase; a nonce remains the endgame). Zod v4's eval-based JIT probe is disabled under this policy via `src/lib/zod-csp.ts` (`z.config({ jitless: true })` — the caught-but-reported probe would otherwise log a violation on every page load). The policy was verified against the built app in a real browser across auth/dashboard/clinical/workflow pages and a full patient-registration flow: zero `securitypolicyviolation` events, zero console errors. Phase 29 re-verified the identical policy byte-for-byte on every route class — pages, redirects, APIs (401/404), and static assets — via 76 raw-header checks (exactly one CSP per response, no duplicate headers, no `unsafe-eval`, no HSTS on the HTTP origin). **Deployment owner**: HSTS is intentionally not set here — the app is served over plain HTTP in dev/staging and this config is shared across environments, so HSTS belongs at the TLS-terminating reverse proxy in front of the deployment (app-level HSTS on a local HTTP origin is inert and would pin browsers to HTTPS for localhost). Set it there as `Strict-Transport-Security: max-age=31536000; includeSubDomains` (add `preload` only after the whole origin tree is HTTPS-capable).
- **Collision-safe business identifiers** — appointment/staff/patient/… identifiers (`APT-151`, `STF-004`, `PT-10482`) are allocated from atomic, monotonic PostgreSQL counters (`src/lib/business-id.ts`) instead of `count(*) + 1`, so concurrent creates can never share an ID and a deleted row's number is never reissued; the per-column UNIQUE constraint remains the final integrity boundary. Seeding re-syncs counters idempotently to the highest number present per table.
- **Dependency posture** — `next` is pinned to **16.3.8** (patches GHSA-vcvr-r3jv-pc5j, the `next/og` ImageResponse RCE; no `next/og` usage exists in this codebase, but the installed version is patched). `source-map-js` was bumped **1.2.1 → 1.2.2** (non-breaking `npm audit fix`, lockfile-only) to clear GHSA-68fv-2mgg-jv7q, an event-loop DoS in the production tree via postcss/tailwind; `npm audit --omit=dev` is clean. The full tree reports 9 findings, **all development-only** transitive chains (`drizzle-kit → @esbuild-kit/esm-loader → esbuild`; `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`) with no production impact — both chains were re-checked at their latest published versions (drizzle-kit 0.31.11, @next/eslint-plugin-next 16.4.0) and still ship the vulnerable dependencies: `@next/eslint-plugin-next` pins `fast-glob` to the exact version `3.3.1` (not a range), so no future `eslint-config-next` release can float it to the patched 3.3.3+, and `@esbuild-kit/core-utils` pins `esbuild` to `~0.18.20` (the advisory covers ≤0.24.2). `npm audit fix` without `--force` resolves none, and `--force` would downgrade `eslint-config-next` to 14.x / `drizzle-kit` to 0.18.1 — both breaking. Upgrades deferred to a future major-bump window rather than forced. Re-verified Phases 28–31 (drizzle-kit@latest now also depends on a patched direct `esbuild ^0.25.4`, but `@esbuild-kit/core-utils@latest` still pins `~0.18.20` — the transitive chain is unchanged; `@next/eslint-plugin-next@16.4.0` still pins `fast-glob` at exactly `3.3.1`).
- **Schema** — migration `0011` adds only two tables (`login_rate_limits`, `business_id_counters`); rollback is `DROP` of those tables. Migration `0012` adds `session_activity` (per-login idle state, pruned after 24h — longer than the absolute lifetime, so pruning can never remove live state); rollback is `DROP`. No existing columns changed in either.

### Demo vs. production readiness

MedCore is a **fully working demonstration system** — real authentication, RBAC, audit trails, migrations, and an enforced test suite — suitable for evaluation, demos, and training with **synthetic data only**. It is **not** ready to hold real patient data: there is no MFA or external identity provider, no TLS termination (deploy behind a reverse proxy), a single PostgreSQL node with no HA or **automated** backup/disaster-recovery (the manual runbook below documents the procedure and a Phase 32 drill verified it end-to-end locally; nothing schedules or verifies it in production), demo credentials (`*@medcore.com` / `medcore123`) are intentionally public, no encryption at rest, and no compliance program (HIPAA/GDPR) or penetration-test attestation. Treat every hardening claim in this README as engineering posture, not regulatory clearance.

### Production startup configuration (fail-fast)

`npm run start` validates the environment **before the server accepts traffic** (`src/instrumentation.ts` → `src/lib/env-guard.ts`): any violated rule prints a `[env-guard]` message that describes the rule (never the value) and the process exits **non-zero**, so a misconfigured deploy shows as a crash instead of a zombie that serves 500s (Phase 29/30: a placeholder secret exits before the port binds; a valid environment boots normally).

| Variable | Classification | Rule |
|---|---|---|
| `AUTH_SECRET` | **Required at runtime** | At least 32 characters (`openssl rand -base64 32`); the public `.env.example` placeholder and the CI dummy string are rejected outright |
| `DATABASE_URL` | **Required at runtime** | Valid `postgresql://` / `postgres://` URL with a host and database name; the `.env.example` placeholder is rejected |
| `AUTH_URL` | **Required at runtime** (or `AUTH_TRUST_HOST`) | The deployment's public origin (e.g. `https://hms.example.com`). Without it (and without `AUTH_TRUST_HOST`), Auth.js derives `trustHost=false` in production and rejects **every** auth request with `UntrustedHost` (500) while `/login` still serves its static shell — reproduced live in Phase 30 |
| `AUTH_TRUST_HOST` | Alternative to `AUTH_URL` | Any non-empty value trusts the forwarded Host header; prefer `AUTH_URL`, which also anchors the Origin CSRF check and the redirect pinning |
| `SESSION_IDLE_TIMEOUT_MINUTES` | Optional | 1–480; invalid values log a warning and fall back to 15 without blocking startup |
| `TEST_DATABASE_URL` | **Test-only** | Integration suite only (names ending `_test` are enforced by the test guard); never read by the application |

Build and runtime stay independent: CI supplies dummy values for the required variables, and `next build` never runs the guard (instrumentation is scoped to server start), so a build artifact can be promoted across environments without carrying deployment credentials.

### Deployment boundary checklist (owner-operated — not verified in production)

The repository ships **no** Dockerfile, reverse-proxy config, or infrastructure-as-code (verified again in Phase 30), so TLS termination and HTTPS policy are entirely the deployment owner's. The application is correct for either posture (it emits **no** HSTS on its own — never set HSTS on plain HTTP, and this app is served over HTTP in local/staging). Against the TLS-terminating proxy:

- Terminate TLS at the proxy and redirect `http://` → `https://` (301/308) **at the proxy**; the Node app itself never sees plaintext in this posture.
- On **HTTPS responses only**, set `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Add `preload` only after a deliberate domain-wide readiness assessment (preload is effectively irreversible for the domain).
- Forward `X-Forwarded-Proto` and `Host` (or set `AUTH_URL` to the public origin, which Auth.js and the app's Origin CSRF check use instead). A wrong `Host` rewrite also breaks login redirects, which are pinned to `AUTH_URL`.
- Overwrite `X-Forwarded-For` at the proxy edge (the rate limiter trusts the **last** entry — see Security & Hardening above).
- Session cookies pick up `Secure` and the `__Secure-` / `__Host-` prefixes automatically once `AUTH_URL` is `https://` (Auth.js derives cookie security from the configured origin) — no app change needed.
- Verify from outside: `curl -sI https://<host>/login` must show HSTS, `curl -sI http://<host>/login` must redirect and must **not** carry HSTS, and the CSP must appear exactly once (a proxy that re-adds headers can duplicate or override policy).

Status: **NOT VERIFIED IN PRODUCTION** — no production deployment is accessible from this repository; the checklist above is the complete set of owner actions.

### Release gate (Phase 32 statuses)

| Category | Status |
|---|---|
| **A. Verified in repository/CI** | 499/499 tests (41 files, incl. 7 new Phase 33 financial/destructive fault-injection, cascade-inventory, and health-counter checks) + 423/76 no-DB split; tsc 0; lint 0 err/6 warn; production build 0; coverage 89.32 % / 87.41 % (audit.ts 100 % statements); prod dependency audit 0; security-header probe 76/76; clinical isolation/mass-assignment probe 43/43; IDOR/RBAC 32/32; refdata/CSP 23/23; workflows 45/45; UI gates 7/7; proxy/privacy 25/25; health endpoint live-verified (anonymous 200 `{status,checks.database}`, `no-store`; audit counter only for `audit:read` sessions); startup fail-fast (public-placeholder secret and missing `AUTH_URL` both exit non-zero before binding — unit + subprocess + live `next start`) |
| **B. Verified in local/test deployment** | Full E2E 49/49 (login, idle expiry, signout tombstone, role rotation) against a local `next start` on PostgreSQL 18.6; true-parallel race probes (same-bed assign, double lab-complete, double dispense, double discharge — one winner/one 409 each, consistent final state); **Phase 33 recovery drill re-run**: fresh-migration idempotent (13 migrations → 25 tables, re-run 0), `pg_dump -Fc` → restore into scratch DB → per-table sorted-row MD5 **25/25 tables identical** (7,135 rows, 24 FK constraints verified; pg_restore's COPY mode firing FK triggers is itself an integrity check), scratch DBs + dump removed; audit-failure fault-injection across clinical + financial + destructive paths (invoice update/delete, claim update, user delete, occupied-bed create — rollback leaves zero partial state, clean retry commits exactly one audit row) and the full 13-table patient-delete cascade verified against real rows; bounded local latency baseline (100× sequential reads + 30 synthetic appointment creates, 0 errors, p50 ≈ 6 ms / p95 ≤ 13 ms — baseline only, no SLO claimed); timing-equalizer and rate-limit probes against live traffic |
| **C. Requires real production evidence** | TLS termination + HSTS at the proxy (deployment-boundary checklist above); production `AUTH_URL`/origin; proxy `X-Forwarded-For` overwrite; backup scheduling, retention, and encryption at rest; MFA / external identity provider; HA and automated disaster recovery; penetration-test attestation; **retention/deletion policy execution** (owner decisions open in `docs/clinical-data-lifecycle-decision-record.md`) |

Production-only items stay **pending** until a real deployment exists; CI passing does not close them.

### Backup & restore runbook (manual — not scheduled)

The deployment owner is responsible for scheduling and monitoring these; the repo ships no automation or retention policy by design (see honesty note above).

```bash
# Backup (run on the DB host; -Fc = custom format, compressible, restorable in one step)
pg_dump -Fc -d medcore -f "medcore-$(date +%Y%m%d-%H%M).dump"

# What to back up together: this dump is the whole app state (all 25 tables +
# counters + session_activity live in one database). No object storage, no
# uploads directory — the app stores no files.

# Restore into a scratch database and smoke-test before trusting the file
createdb medcore_restore
pg_restore -d medcore_restore medcore-YYYYMMDD-HHMM.dump

# Point-in-time recovery (requires wal_level=replica + WAL archiving on the host)
# — configure on the PostgreSQL host, not in this repo.
```

Verify each dump by restoring it; an untested backup is not a backup. Keep copies off the database host, encrypt them at rest (the database itself is not encrypted — see above), and rehearse a restore drill as part of the same operational review that covers MFA/TLS/compliance.

**Phase 32 recovery drill (local, verified)** — this runbook was executed end-to-end against PostgreSQL 18: a scratch database was created, all 13 migrations applied (25 tables, idempotent re-run), the development database dumped with `pg_dump -Fc`, restored with `pg_restore` into a second scratch database, and every table compared by sorted-row MD5 checksum — **25/25 tables byte-identical**. Phase 33 re-ran the same drill at the new baseline (25/25 identical across 7,135 rows; FK-constraint count 24/24; row counts per table verified). The drill verifies the *procedure*, not a production backup: no schedule, retention, off-host copy, or encryption exists (owner-operated, see category C above). Scratch databases and the dump file were removed afterward; nothing containing data was committed or retained.

---

## ✅ Quality Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ Pass — strict TypeScript, zero errors |
| `npm run lint` | ✅ Pass — 0 errors, 6 pre-existing warnings (none new this phase) |
| `npm test` | ✅ Pass — 499 checks total: 423 run without a test database (unit + gate, 76 integration skipped); all 499 with `TEST_DATABASE_URL` set |
| `npm run test:coverage` | ✅ Pass — 89.32% statements / 87.41% branches over `src/lib` + `src/types` (Phase 33 added financial/destructive fault-injection, cascade-inventory, and health-counter tests; `audit.ts` at 100% statements; session config & session-activity 100%, rate limiter 94%, validations 95%, seed operations 97%) |
| `npm run build` | ✅ Pass — production build |
| **CI (GitHub Actions)** | ✅ GitHub-hosted PASS (last verified run `38421453796` on the Phase 31 commit before this phase; every push/PR to `main` re-runs it) — `next typegen` → `tsc` → lint → tests → build (`.github/workflows/ci.yml`) |
| **External harness** *(not committed, not re-run by CI)* | ✅ Phase 33 re-ran the security/workflow suites against the Phase 33 build — headers 76/76, E2E 49/49, workflows 45/45, IDOR/RBAC 32/32, proxy/privacy 25/25, clinical isolation/mass-assignment 43/43, timing (ratio 1.01× / IQR-overlap invariants; the probe's machine-calibrated 80 ms absolute floor measured ~68 ms on this host — documented CPU-state variance, thresholds untouched, auth path unchanged), rate-limit, health-auth. UI gates 7/7, refdata/CSP 23/23, and bcrypt-edge were not re-run this phase: their code has zero diff from the Phase 32/29 baseline where they passed |
| — API contract suites | auth, records, beds, pharmacy, lab, surgery, emergency, billing |
| — Concurrency tests | 8 parallel bed races + 5 transfer races (same patient, same destination ×3, vs release, vs assign) → exactly-one-success, deterministic 409s |
| — DB integrity tests | occupancy invariants, orphan checks, cascade cleanup |
| — Notification delivery | unread-count badge poll, recipient isolation, mark-read badge sync, poll safety |
| — Static source gates | no `console.log`, no fake delays, no mock data in shipped pages |
| **M11-M audit harness** *(external — not committed)* | ✅ **827 / 827 checks green** (responsive sweep, axe, keyboard, states, cross-browser, security) |
| **axe-core (WCAG)** *(manual verification)* | ✅ **0 violations across 29 routes** |
| **Lighthouse (desktop + mobile)** *(manual verification)* | ✅ login 100/100/100/100 · dashboard 100/100/100/100 · patients 100/100/100/100 · mobile 96/100/100/100 — all categories > 90 |
| **Error boundaries** *(manual verification)* | ✅ live-tested 9/9 — root + dashboard loading/error, global-error, friendly 404 |
| **Schema discipline** | ✅ No migration without an approved gate |

---

## 🧪 Testing & CI

MedCore ships with a committed **Vitest** suite under `tests/` — no other test framework.

| Command | What it runs |
|---------|--------------|
| `npm test` | Full suite (fast — skips DB integration unless `TEST_DATABASE_URL` is set) |
| `npm test -- tests/unit/rbac.test.ts` | A single file |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage scoped to `src/lib` + `src/types` (v8 provider, HTML report in `coverage/`) |

**Unit tests** (`tests/unit/`) exercise the real implementations — never copies — of the pure-function core: billing math & unique-violation detection, the RBAC role/permission matrix (`src/types/auth.ts`), every shared Zod validation schema (patient, appointment, invoice, pagination, clinical), prescription-to-medicine matching, the login rate-limiter's trust-boundary parsing (rightmost `x-forwarded-for`, IPv4/IPv6 validation, storage-safe key bounds), store-error classification, and guard/observer logic (with a fake store), business-ID formatting and registry invariants, dashboard visibility rules, the absolute-session enforcement paths (sign-in stamp, legacy `iat` fallback, malformed claims, repeated-refresh non-extension, cookie clearing), and the idle-timeout layer: configuration validation and fallback, idle-proportional ping/throttle intervals (worst-case staleness stays below every legal window), the `sid` claim (stamped once, stable across re-encodes while `jti` re-mints), the session-liveness gate (fail-closed on store errors, one-shot expiry audit, DB-fresh role refresh, missing-claim rejection), the login `callbackUrl` sanitizer (same-origin-only open-redirect matrix), the `/api/auth/activity` ping endpoint's auth/Origin/CSRF decisions, and the sign-out revocation wiring (tombstone on success; skipped for rejected responses, foreign/garbage, or sid-less tokens; best-effort when the store fails). The guarded suite also asserts matrix invariants (42 unique permission keys, `patients:delete` = ADMIN only) so a silent refactor of the permission table fails CI. Contract tests cover the authz boundaries of key mutation routes (unauthenticated → 401, wrong role → 403, expected roles → allowed, for prescriptions, discharge, bed transfer, dispensing, lab completion, and billing), the Phase 28 reference-data contract (`GET /api/reference` → 401 anon / 403 without `patients:write` / 200 shape equality with the directory, and phantom department/attending-doctor rejection on patient create/update), the pure clinical workflow-state rules (discharge admitted-only + no pending invoices/consultations; transfer requires an occupied source bed, an available destination, source ≠ destination, and a non-discharged patient), and a source-level gate proves auth failures never log an email address. Phase 32 added the **audit-reliability** units: `insertAuditRow` throws on executor failure while `recordAudit` never throws and increments the failure counter (resettable between tests), the counter reports/exposes correctly, and the health endpoint's contract (anonymous 200 + `database` check, `no-store`, no secret leakage, `auditWriteFailures` visible only to `audit:read` sessions) is asserted without a database.

**Integration tests** (`tests/integration/`) run against a throwaway PostgreSQL database and verify real schema behavior: migrations apply idempotently, duplicate keys raise `23505` (caught by `isUniqueViolation`), `medical_records` cascade on patient delete, transactions roll back cleanly, the rate-limit store counts/blocks/resets/fails open against real rows (including oversized-identifier sibling isolation and atomic concurrent increments), business-ID allocation bootstraps from existing data, never reuses deleted numbers, and stays unique under concurrency **across all 12 registered prefixes**, the session-activity store seeds missing rows from sign-in time (no fresh grace), evaluates idleness purely in SQL, throttles input writes, rejects foreign/deleted-user sessions, flags expiry once, never refreshes a finalized sid (idle-expired or sign-out-revoked), and prunes by retention; the wrapped `/api/auth/session` guard passes live sessions through without recording activity, audits an expiry exactly once, seeds stale rows already expired, serves anonymous nulls, and kills a sign-out-resurrected session via the tombstone without audit noise; and the demo seed never writes the owner's identity into clinical records. Phase 28 added the **clinical-workflows** suite: discharge and transfer against real rows — 401/403/400/404/409 paths, happy-path audit attribution (the audit row records the acting session user), repeat-discharge 409, per-test `CHECK (… ) NOT VALID` constraints proving failed transitions roll the transaction back (the 500 is a logged rollback, never a silent partial commit), and transfer atomically freeing the source and occupying the destination in one transaction with a single `patient.transfer` audit. Phase 32 added the **audit-reliability** suite against real rows: a fault-injected audit-write failure rolls the dispense transaction back (prescription still Active, stock unchanged — zero partial side effects) and a clean retry then succeeds; lab complete carries the same rollback guarantee; a database-level FK violation on the audit insert proves the clinical write shares the audit row's fate; and patient delete verifies the full cascade (13 clinical children removed), bed release in the same transaction, and audit rows surviving the entity's removal. Phase 33 extended the suite with **financial/destructive fault injection**: billing invoice update and delete, insurance claim update, user delete, and occupied-bed create each roll back to zero partial state under an injected audit-write failure and commit exactly one audit row on a clean retry; a new cascade-inventory test seeds one row in every one of the 13 child tables and asserts all are erased on patient delete while user-scoped notifications stay intact; and the health-endpoint unit tests prove `auditWriteFailures` reports the live counter rather than a constant. Safety rules:

- `TEST_DATABASE_URL` must be set **explicitly** — it is never derived from `DATABASE_URL`.
- The target database name must end with `_test`, otherwise the suite refuses before any connection.
- Test files run **sequentially** (`fileParallelism: false`) — they share one guarded `*_test` database and seed exact row counts, so files must never mutate it concurrently.
- When unset, the integration tests **skip** (unit tests still run), so contributors without a test database are never blocked.

```bash
# integration tests create the *_test database automatically when missing
# (the guard only allows database names ending in _test)
TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/medcore_test" npm test
```

**CI** — `.github/workflows/ci.yml` runs on every push and pull request to `main` with least-privilege permissions (`contents: read`): `npm ci` → `npx next typegen` (generates the `.next/types` route types that `LayoutProps<"/">` depends on; absent in a fresh checkout) → `npx tsc --noEmit` → `npm run lint` → `npm test` (against a `postgres:16-alpine` service, `medcore_test`) → `npm run build`, on Node 22.

**Honest scope** — this suite covers the lib/types layer, DB integrity, and authz contract tests for key route handlers, *not* the full API surface or React components (those remain covered by the external 1,549-check harness, which is not committed to this repository). All four gates pass locally, and the GitHub-hosted workflow passes on `main` (last verified run on the Phase 31 commit `38421453796`; the first-ever run failed because `tsc` ran before Next's route-type codegen, fixed in `396e6d9`).

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/anuragY77/medcore-enterprise-hms.git
cd medcore-enterprise-hms

# 2. Install
npm install

# 3. Configure
cp .env.example .env.local   # add your PostgreSQL URL

# 4. Migrate + seed
npx drizzle-kit generate
npx drizzle-kit migrate
npm run seed:demo      # guarded demo dataset (refuses production-like DBs)

# 5. Verify the quality gates
npx tsc --noEmit
npm run lint
npm test          # DB integration tests run when TEST_DATABASE_URL is set

# 6. Launch
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** 🎉

### 🌱 Demo Data

`npm run seed:demo` loads a realistic, deterministic demo dataset in a single
transaction: 80 patients (≈85 % Indian names, 12 international), 18 staff,
94 beds, 150 appointments, 210 prescriptions, 110 invoices, 24 pharmacy
medicines, ER cases, surgeries and more. The seed:

- **requires explicit confirmation** (`--demo` flag or `SEED_DEMO_DATA=1`)
  and **refuses** production-like database names, non-loopback hosts and
  `NODE_ENV=production` — it fails closed before opening a connection;
- **never deletes or truncates** existing data — only upserts (stable IDs +
  natural keys, so re-running is idempotent and never duplicates rows);
- runs everything in **one transaction** — a failure rolls the whole run back;
- keeps the demo administrator branded as **Anurag Yadav** (`admin@medcore.com`).

### 🔑 Demo Credentials

| Role | Name | Email | Password |
|------|------|-------|----------|
| 🛡️ Admin | Anurag Yadav | `admin@medcore.com` | `medcore123` |
| 🩺 Doctor | Dr. James Wilson | `doctor@medcore.com` | `medcore123` |
| 💗 Nurse | Nurse Emily Chen | `nurse@medcore.com` | `medcore123` |
| 🙋 Reception | Maria Garcia | `reception@medcore.com` | `medcore123` |
| 💊 Pharmacy | Pharm. David Kim | `pharmacy@medcore.com` | `medcore123` |

> 💡 Log in as **admin** for the full experience, then switch roles to see RBAC in action — menus, buttons, and API responses all change.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/login/           # 🔑 Auth flow
│   ├── (dashboard)/            # 🖥️ 20 authenticated modules
│   │   ├── patients/           #    registry + [id] chart, records, admission, discharge
│   │   ├── appointments/       #    scheduling lifecycle
│   │   ├── beds/               #    inpatient lifecycle UI
│   │   ├── nursing/            #    nurse station
│   │   └── billing|insurance/  #    revenue cycle
│   └── api/                    # ⚡ 54 route handlers (RBAC + validation)
├── components/                 # 🧩 81 reusable components
├── lib/
│   ├── auth.ts                 #    NextAuth + session
│   ├── audit.ts                #    append-only audit writer
│   ├── db/                     #    schema (25 tables) + migrations
│   └── validations/            #    shared Zod schemas
└── types/auth.ts               # 🔐 roles + permission matrix
```

---

## 🗄️ Database

**25 PostgreSQL tables** connected by real foreign keys — patients, staff, appointments, beds, medical records, prescriptions, invoices, claims, inventory, surgeries, emergency cases, audit logs, and more.

- Type-safe through Drizzle ORM end-to-end
- Referential integrity (`ON DELETE` policies) — orphan-free by construction
- Migrations are versioned in `drizzle/`

---

## 🗺️ Roadmap

- [x] Auth, RBAC & audit foundation
- [x] 20 operational modules with live data
- [x] Billing & insurance revenue cycle
- [x] Inpatient bed lifecycle (admission → discharge)
- [x] Bed lifecycle hardening (race-free transactions, double-admission guard, audited + notified)
- [x] Atomic patient transfer (single-transaction release + assign, audited + notified)
- [x] Notification delivery engine
- [x] Phase 13 — testing, responsiveness & polish (accessibility, error boundaries, Lighthouse, cross-browser)
- [x] Phase 31 — concurrency-invariant race hardening (true-parallel probes, exactly-one-winner proofs)
- [x] Phase 32 — audit reliability & operational resilience (same-transaction audit on 11 clinical routes, failure counter + health endpoint, recovery drill, lifecycle decision record, latency baseline)
- [x] Phase 33 — deep integrity verification & clinical data safety (same-transaction audit completed on all 19 transactional routes — financial + destructive conversions, occupied-bed-create audit added; full patient-delete cascade inventory verified; DB-immutability trigger proposal documented as decision 6; recovery drill re-run; security/perf regression probes)
- [ ] Payment gateway integration
- [ ] External HL7/FHIR integrations
- [ ] Staff scheduling (availability / leave / shifts) — **blocked on a product-owner decision**; the seven open questions and the approval template live in `docs/staff-scheduling-decision-record.md`. No schema, permissions, or UI exist for it, by design.
- [ ] Data retention / patient-deletion policy execution — **blocked on a product-owner decision**; five open questions and the approval template live in `docs/clinical-data-lifecycle-decision-record.md`. The current hard-cascade delete behavior is documented, not endorsed, by design.

---

## 📜 License

Private — All rights reserved.

---

<div align="center">

**Built with obsessive attention to correctness — every claim in this README is backed by automated checks or verified source.**

`★ Star the repo if you find it impressive` · [Report an issue](https://github.com/anuragY77/medcore-enterprise-hms/issues)

</div>

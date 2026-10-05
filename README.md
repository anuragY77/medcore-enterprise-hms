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
| **20** | **52** | **32** | **22** | **9** |
| [Modules](#modules) | API Routes | Pages | DB Tables | RBAC Roles |
| **79** | **41** | **1,549** | **0** |
| Components | Permission Keys | Automated Checks | Build Errors |

</div>

---

## 🎯 Why MedCore?

Most portfolio HMS projects stop at CRUD screens with fake data. MedCore goes further:

- **🔒 Real security** — every API is authenticated and permission-checked server-side; UI gating is a convenience, the backend is the source of truth.
- **🔁 Real workflows** — admit → assign bed → occupy → transfer → discharge → release, with transactional integrity, deadlock-safe locking, and audit trails.
- **🧾 Real billing** — invoices, payments, insurance claims, approvals — computed from actual line items, never hard-coded.
- **🧪 Really tested** — 1,549 automated checks across 17 regression suites (API contracts, RBAC matrices, DB integrity, concurrency races, notification delivery, static source gates), plus strict `tsc`, ESLint, and production build gates. The suites run from a local harness outside this repository; the committed gates are `tsc`, lint, the committed Vitest test suite, and build — the same four gates wired into CI for every push and pull request.
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
| 4 | 👨‍⚕️ **Staff** | Doctors & staff directory, departments, scheduling |
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
        API->>DB: COMMIT
        API->>AUD: patient.admit (safe IDs only)
        API->>N: attending-doctor notification
        API-->>UI: 200 OK
    end
```

Failed guards return before any write — no audit rows, no notifications, no partial state. The same pattern covers assign, release, transfer, discharge, and patient delete.

---

## 🔒 Security & Hardening

- **Brute-force login protection** — every credentials sign-in attempt passes through a PostgreSQL-backed rate limiter (`src/lib/login-rate-limit.ts`) before NextAuth runs. Repeated failures within a rolling window temporarily throttle the attempt (keyed by client + account, with a separate source-only key when the account field is unreadable or too long to store safely); a successful sign-in clears the keys, and blocks are always temporary — never permanent — so a legitimate user can never be locked out for long. Exact thresholds are internal policy and deliberately undocumented. If the limiter's own database access fails it **fails open** (login proceeds, error logged — genuine outages and possible defects are logged distinctly, so a bug cannot hide behind "the database was down"), because a database outage must never keep clinicians out of the hospital system. Responses stay generic — the UI never reveals whether an account exists. **Client-address trust**: the source IP is taken from the *last* `x-forwarded-for` entry — the one appended by the nearest proxy; a client-supplied prefix to its left is ignored — so deploy behind a reverse proxy that **overwrites** `x-forwarded-for`. On a directly exposed server that header is client-controlled and IP keying degrades accordingly; header tokens are validated as literal IPv4/IPv6 addresses, so a garbage header can only ever produce the shared `unknown` key, never an unbounded one.
- **Explicit session lifetime** — sessions are JWTs with a **12-hour absolute lifetime** (`src/lib/session-config.ts`), enforced at every session read: the sign-in timestamp (`authAt` claim) is pinned once and never extended, so ordinary activity — including repeated `/api/auth/session` refreshes from the polling UI — cannot slide expiry; tokens past the limit are rejected and the cookie cleared (tokens minted before the claim existed adopt their own `iat`). Auth redirects are pinned to the configured `AUTH_URL` origin rather than a request-supplied Host, which doubles as a Host-header redirect-poisoning defense — set `AUTH_URL` to the deployment's real public origin.
- **Server-side idle timeout** — in addition to the absolute lifetime, sessions expire after a configurable inactivity window (default **15 minutes**, `SESSION_IDLE_TIMEOUT_MINUTES`, validated to 1–480 minutes; an invalid value logs a warning and falls back to the default rather than crashing startup). **Activity means real user input only**: page/RSC navigations (`src/proxy.ts`, prefetches skipped) and input-driven pings to `POST /api/auth/activity` from `src/components/auth/session-activity-monitor.tsx`. Background `/api/auth/session` polls and badge refreshes are structurally excluded from recording, and idle state lives in PostgreSQL (`session_activity`, migration `0012`, keyed by a stable per-login `sid` JWT claim — never a claim re-stamped by Auth.js's re-encode on every session read), so polling can never slide the idle clock. Enforcement runs inside the wrapped `auth()` used by middleware, every API route, and the `/api/auth/session` response, with all time comparisons performed **in the database** (`now()` vs `last_activity`) — no JS/DB timestamp arithmetic. Policy is **fail-closed**: if the activity store is unavailable the request is rejected and logged (outage vs defect classified; login-time pruning is best-effort and never blocks sign-in). Idle expiry never extends or shortens the absolute lifetime — both checks pass or the session is rejected — and each expiry is audited exactly once (`auth.session_idle_expired`). Because enforcement is server-side, the client countdown (warning banner shown at 20% of the window remaining, lead time delivered by the server in the session payload) is purely informational: discovery happens on the next navigation or ping, which redirect to `/login?error=SessionExpired`.
- **Sign-out is terminal** — Auth.js JWT sessions are stateless, so signing out only clears the cookie: a session poll in flight from another tab could re-issue the still-valid token *after* the clear and resurrect the "logged out" session (a race reproduced intermittently by the Phase 20 browser probes). `POST /api/auth/signout` therefore also **tombstones** the session's `session_activity` row (epoch `last_activity`, `expired_logged` pre-flipped), and activity recording (`recordSessionActivity`) refuses to refresh any finalized sid — so the resurrected token fails the liveness gate on its very next request or navigation instead of resuming a live session. The tombstone is best-effort (sign-out must succeed during a store outage, and liveness already fails closed while the store is unreachable) and the pre-flipped flag means the forced rejection emits no spurious idle-expiry audit.
- **Safe login redirects** — the login page's `callbackUrl` parameter is sanitized (`src/lib/safe-redirect.ts`): only same-origin absolute paths are honored, protocol-relative (`//evil.example`, `/\evil.example`) and control-character payloads are rejected, so a crafted login link can never bounce an authenticated user (or their credentials form action flow) to an attacker origin. Every other `callbackUrl` in the app is a path the server itself produced.
- **Dashboard data scoping** — `GET /api/dashboard/stats` returns invoice totals only to roles holding `billing:read` (ADMIN, RECEPTIONIST, BILLING; others get `null` and the Billing Summary card is hidden) and the audit-derived activity feed only to roles holding `audit:read` (ADMIN, SECURITY; others get an empty timeline). All other blocks are non-identifying operational counts shared by every signed-in role.
- **Collision-safe business identifiers** — appointment/staff/patient/… identifiers (`APT-151`, `STF-004`, `PT-10482`) are allocated from atomic, monotonic PostgreSQL counters (`src/lib/business-id.ts`) instead of `count(*) + 1`, so concurrent creates can never share an ID and a deleted row's number is never reissued; the per-column UNIQUE constraint remains the final integrity boundary. Seeding re-syncs counters idempotently to the highest number present per table.
- **Dependency posture** — `next` is pinned to **16.3.8** (patches GHSA-vcvr-r3jv-pc5j, the `next/og` ImageResponse RCE; no `next/og` usage exists in this codebase, but the installed version is patched). Remaining `npm audit` findings are **development-only** transitive chains (drizzle-kit/esbuild, eslint-config-next tooling) with no production impact; npm's suggested fixes are semver-major downgrades and were rejected deliberately rather than applied blindly.
- **Schema** — migration `0011` adds only two tables (`login_rate_limits`, `business_id_counters`); rollback is `DROP` of those tables. Migration `0012` adds `session_activity` (per-login idle state, pruned after 24h — longer than the absolute lifetime, so pruning can never remove live state); rollback is `DROP`. No existing columns changed in either.

### Demo vs. production readiness

MedCore is a **fully working demonstration system** — real authentication, RBAC, audit trails, migrations, and an enforced test suite — suitable for evaluation, demos, and training with **synthetic data only**. It is **not** ready to hold real patient data: there is no MFA or external identity provider, no TLS termination (deploy behind a reverse proxy), a single PostgreSQL node with no HA or backup/disaster-recovery story, demo credentials (`*@medcore.com` / `medcore123`) are intentionally public, no encryption at rest, and no compliance program (HIPAA/GDPR), penetration-test attestation, or data-recovery drills. Treat every hardening claim in this README as engineering posture, not regulatory clearance.

---

## ✅ Quality Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ Pass — strict TypeScript, zero errors |
| `npm run lint` | ✅ Pass — 0 errors, 8 pre-existing warnings (none new this phase) |
| `npm test` | ✅ Pass — 243 checks total: 193 run without a test database (unit + gate, 50 integration skipped); all 243 with `TEST_DATABASE_URL` set |
| `npm run test:coverage` | ✅ Pass — 80.3% statements / 81.7% branches over `src/lib` + `src/types` (session config & session-activity 100%, session liveness 96%, rate limiter 94%, seed 95%) |
| `npm run build` | ✅ Pass — production build |
| **CI (GitHub Actions)** | ✅ GitHub-hosted PASS (run `37353028188`) — `next typegen` → `tsc` → lint → tests → build on push/PR to `main` (`.github/workflows/ci.yml`) |
| **17 test suites** | ✅ **1,549 / 1,549 checks green** |
| — API contract suites | auth, records, beds, pharmacy, lab, surgery, emergency, billing |
| — Concurrency tests | 8 parallel bed races + 5 transfer races (same patient, same destination ×3, vs release, vs assign) → exactly-one-success, deterministic 409s |
| — DB integrity tests | occupancy invariants, orphan checks, cascade cleanup |
| — Notification delivery | unread-count badge poll, recipient isolation, mark-read badge sync, poll safety |
| — Static source gates | no `console.log`, no fake delays, no mock data in shipped pages |
| **M11-M audit harness** | ✅ **827 / 827 checks green** (responsive sweep, axe, keyboard, states, cross-browser, security) |
| **axe-core (WCAG)** | ✅ **0 violations across 29 routes** |
| **Lighthouse (desktop + mobile)** | ✅ login 100/100/100/100 · dashboard 100/100/100/100 · patients 100/100/100/100 · mobile 96/100/100/100 — all categories > 90 |
| **Error boundaries** | ✅ live-tested 9/9 — root + dashboard loading/error, global-error, friendly 404 |
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

**Unit tests** (`tests/unit/`) exercise the real implementations — never copies — of the pure-function core: billing math & unique-violation detection, the RBAC role/permission matrix (`src/types/auth.ts`), every shared Zod validation schema (patient, appointment, invoice, pagination, clinical), prescription-to-medicine matching, the login rate-limiter's trust-boundary parsing (rightmost `x-forwarded-for`, IPv4/IPv6 validation, storage-safe key bounds), store-error classification, and guard/observer logic (with a fake store), business-ID formatting and registry invariants, dashboard visibility rules, the absolute-session enforcement paths (sign-in stamp, legacy `iat` fallback, malformed claims, repeated-refresh non-extension, cookie clearing), and the idle-timeout layer: configuration validation and fallback, idle-proportional ping/throttle intervals (worst-case staleness stays below every legal window), the `sid` claim (stamped once, stable across re-encodes while `jti` re-mints), the session-liveness gate (fail-closed on store errors, one-shot expiry audit, DB-fresh role refresh, missing-claim rejection), the login `callbackUrl` sanitizer (same-origin-only open-redirect matrix), the `/api/auth/activity` ping endpoint's auth/Origin/CSRF decisions, and the sign-out revocation wiring (tombstone on success; skipped for rejected responses, foreign/garbage, or sid-less tokens; best-effort when the store fails). The guarded suite also asserts matrix invariants (41 unique permission keys, `patients:delete` = ADMIN only) so a silent refactor of the permission table fails CI.

**Integration tests** (`tests/integration/`) run against a throwaway PostgreSQL database and verify real schema behavior: migrations apply idempotently, duplicate keys raise `23505` (caught by `isUniqueViolation`), `medical_records` cascade on patient delete, transactions roll back cleanly, the rate-limit store counts/blocks/resets/fails open against real rows (including oversized-identifier sibling isolation and atomic concurrent increments), business-ID allocation bootstraps from existing data, never reuses deleted numbers, and stays unique under concurrency **across all 12 registered prefixes**, the session-activity store seeds missing rows from sign-in time (no fresh grace), evaluates idleness purely in SQL, throttles input writes, rejects foreign/deleted-user sessions, flags expiry once, never refreshes a finalized sid (idle-expired or sign-out-revoked), and prunes by retention; the wrapped `/api/auth/session` guard passes live sessions through without recording activity, audits an expiry exactly once, seeds stale rows already expired, serves anonymous nulls, and kills a sign-out-resurrected session via the tombstone without audit noise; and the demo seed never writes the owner's identity into clinical records. Safety rules:

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

**Honest scope** — this suite covers the lib/types layer and DB integrity, *not* API route handlers or React components (those remain covered by the external 1,549-check harness, which is not committed to this repository). All four gates pass locally, and the GitHub-hosted workflow passes on `main` (run `37353028188`; the first run failed because `tsc` ran before Next's route-type codegen, fixed in `396e6d9`).

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
│   └── api/                    # ⚡ 52 route handlers (RBAC + validation)
├── components/                 # 🧩 79 reusable components
├── lib/
│   ├── auth.ts                 #    NextAuth + session
│   ├── audit.ts                #    append-only audit writer
│   ├── db/                     #    schema (22 tables) + migrations
│   └── validations/            #    shared Zod schemas
└── types/auth.ts               # 🔐 roles + permission matrix
```

---

## 🗄️ Database

**22 PostgreSQL tables** connected by real foreign keys — patients, staff, appointments, beds, medical records, prescriptions, invoices, claims, inventory, surgeries, emergency cases, audit logs, and more.

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
- [ ] Payment gateway integration
- [ ] External HL7/FHIR integrations

---

## 📜 License

Private — All rights reserved.

---

<div align="center">

**Built with obsessive attention to correctness — every claim in this README is backed by automated checks or verified source.**

`★ Star the repo if you find it impressive` · [Report an issue](https://github.com/anuragY77/medcore-enterprise-hms/issues)

</div>

# Memory.md
## MedCore Premium Enterprise Hospital Management System

**Created:** August 30, 2026

---

## Current State

```
Phase 0: COMPLETE
Phase 1: COMPLETE
Phase 2: COMPLETE
Phase 3: COMPLETE
Phase 4: COMPLETE
NEXT: Phase 5 — Patient Management & Workflows
```

---

## Phase 4 — COMPLETE (August 31, 2026)

### Implementation Summary
- Hospital Operations Dashboard with 7 reusable components
- Recharts installed for data visualization
- Centralized mock data in `dashboard-data.ts`
- RBAC-aware Quick Actions using existing `hasPermission()` from `@/types/auth`
- 4 KPI stats cards (Total Patients, Occupied Beds, Appointments, Active Cases)
- Operations Overview widget (Admissions, Discharges, Pending, ER Visits)
- Department Status grid (6 departments with bed occupancy and status badges)
- Activity Timeline (10 events with timestamps and severity indicators)
- Patient Admissions Chart (7-day line chart)
- Department Utilization Chart (bar chart with color-coded thresholds)
- Responsive grid layout (mobile, tablet, desktop)
- DS1 design tokens preserved throughout

### Key Files
| File | Purpose |
|------|---------|
| `src/components/dashboard/dashboard-data.ts` | Centralized mock data + TypeScript interfaces |
| `src/components/dashboard/stats-card.tsx` | Reusable KPI metric card |
| `src/components/dashboard/operations-overview.tsx` | 4-metric operations widget |
| `src/components/dashboard/department-status.tsx` | Department grid with status badges |
| `src/components/dashboard/activity-timeline.tsx` | Chronological event feed |
| `src/components/dashboard/quick-actions.tsx` | RBAC-aware action links |
| `src/components/dashboard/patient-admissions-chart.tsx` | Recharts line chart |
| `src/components/dashboard/department-utilization-chart.tsx` | Recharts bar chart |
| `src/app/(dashboard)/page.tsx` | Dashboard page assembly |

### RBAC Behavior
- Quick Actions filter by `hasPermission(role, permission)` from existing auth system
- Permission keys used: `patients:write`, `appointments:write`, `pharmacy:read`, `laboratory:read`, `users:read`
- Unauthorized actions are hidden, not disabled

### Validation Results
| Check | Status | Date |
|-------|--------|------|
| npx tsc --noEmit | PASS | Aug 31, 2026 |
| npm run lint | PASS (0 errors, 1 pre-existing warning) | Aug 31, 2026 |
| npm run build | PASS (33 routes) | Aug 31, 2026 |
| No auth modifications | VERIFIED | Aug 31, 2026 |
| No database modifications | VERIFIED | Aug 31, 2026 |
| No Stitch modifications | VERIFIED | Aug 31, 2026 |
| DS1 tokens preserved | VERIFIED | Aug 31, 2026 |
| RBAC permissions correct | VERIFIED | Aug 31, 2026 |

---

## Phase 3 — COMPLETE (August 31, 2026)

### Implementation Summary
- Drizzle ORM with PostgreSQL driver (`drizzle-orm`, `pg`, `drizzle-kit`, `@types/pg`, `tsx`)
- Users table schema: UUID PK, unique email, role varchar, avatar nullable, timestamps
- Versioned Drizzle migrations via `drizzle-kit generate` + `drizzle-kit migrate`
- Database connection module at `src/lib/db/index.ts`
- Seed script at `src/lib/db/seed.ts` (idempotent upsert on email conflict)
- Auth migrated from in-memory `findUserByEmail` to PostgreSQL-backed Drizzle query
- Runtime role validation against 9 RBAC roles before accepting into session
- Avatar nullability handled: PostgreSQL `null` → JS `undefined` via `?? undefined`
- `src/lib/seed-users.ts` kept unchanged as reference
- Phases.md internally consistent: Dashboard restored as Phase 4, subsequent phases renumbered 5-13

### Key Files
| File | Purpose |
|------|---------|
| `drizzle.config.ts` | Drizzle Kit configuration (PostgreSQL, schema path, migrations output) |
| `src/lib/db/schema.ts` | Users table Drizzle schema |
| `src/lib/db/index.ts` | Database connection + exports |
| `src/lib/db/seed.ts` | Idempotent seed script (5 demo users, bcrypt passwords) |
| `src/lib/auth.ts` | Updated: DB query, role validation, avatar null handling |
| `drizzle/migrations/0000_abandoned_johnny_storm.sql` | Initial migration (users table) |

### Database
- PostgreSQL 18, port 5432, user `postgres`, database `medcore`
- `DATABASE_URL` in `.env.local`: `postgresql://postgres:medcore123@localhost:5432/medcore`
- 5 seeded users with bcrypt-hashed passwords

### Packages Added
- `drizzle-orm`
- `pg`
- `drizzle-kit` (devDependency)
- `@types/pg` (devDependency)
- `tsx` (devDependency)

### Validation Results
| Check | Status | Date |
|-------|--------|------|
| npx tsc --noEmit | PASS | Aug 31, 2026 |
| npm run lint | PASS (0 errors, 1 pre-existing warning) | Aug 31, 2026 |
| npm run build | PASS (33 routes) | Aug 31, 2026 |
| drizzle-kit generate | PASS | Aug 31, 2026 |
| drizzle-kit migrate | PASS | Aug 31, 2026 |
| Seed script (first run) | PASS (5 inserts) | Aug 31, 2026 |
| Seed script (idempotent) | PASS (5 updates) | Aug 31, 2026 |
| Auth: valid login | PASS | Aug 31, 2026 |
| Auth: invalid password | PASS | Aug 31, 2026 |
| Auth: role validation | PASS | Aug 31, 2026 |
| Auth: avatar null handling | PASS | Aug 31, 2026 |
| Auth: all 5 users seeded | PASS | Aug 31, 2026 |
| Auth: all roles valid | PASS | Aug 31, 2026 |

---

## Phase 2 — COMPLETE (August 30, 2026)

### Implementation Summary
- Auth.js v5 (`next-auth@beta` 5.0.0-beta.32) with Credentials provider
- JWT session strategy (no database dependency)
- Route protection via `src/proxy.ts` (Next.js 16 convention)
- 9 RBAC roles defined in `src/types/auth.ts` (ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, LAB_TECHNICIAN, BILLING, SURGEON, SECURITY)
- 5 development demo users in `src/lib/seed-users.ts` with bcrypt-hashed passwords
- `bcryptjs` used for password verification
- Login page connected to auth flow with error/loading/callbackUrl support
- Topbar uses session data for user info and sign-out
- Auth route handler at `src/app/api/auth/[...nextauth]/route.ts` with `force-dynamic`
- Root layout wrapped with AuthProvider (SessionProvider)

### Key Files
| File | Purpose |
|------|---------|
| `src/types/auth.ts` | Roles, permissions, hasPermission(), hasAnyPermission() |
| `src/lib/auth.ts` | NextAuth config: Credentials provider, JWT, type augmentations |
| `src/lib/seed-users.ts` | Dev seed users with bcrypt-hashed passwords |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth route handler (force-dynamic) |
| `src/proxy.ts` | Route protection (redirects unauthenticated to /login) |
| `src/components/auth-provider.tsx` | Client-side SessionProvider wrapper |

### Demo Credentials (Development Only)
| Email | Password | Role |
|-------|----------|------|
| admin@medcore.com | medcore123 | ADMIN |
| doctor@medcore.com | medcore123 | DOCTOR |
| nurse@medcore.com | medcore123 | NURSE |
| reception@medcore.com | medcore123 | RECEPTIONIST |
| pharmacy@medcore.com | medcore123 | PHARMACIST |

### Important Notes
- Demo users are now database-backed in PostgreSQL (migrated from in-memory in Phase 3).
- `src/lib/seed-users.ts` kept as reference; `src/lib/db/seed.ts` is the active seed script.
- Demo credentials must not be treated as production credentials.
- AUTH_SECRET in `.env.local` is a dev placeholder.
- No password reset, account lockout, session timeout, or rate limiting implemented.

### Dependencies Added
- `next-auth@beta` (5.0.0-beta.32)
- `bcryptjs` (3.0.3)
- `@types/bcryptjs` (2.4.6, devDependency)

---

## Next Phase: Phase 5 — Patient Management & Workflows

### Scope
- Patient list page (matching reference `06c808187a414228951efbc4d8b2c27e`)
- Patient record page (matching reference `83179e75c63d4b178157081e6dc4fc35`)
- New patient registration (matching reference `6b714d4db90041ba92a7fe2a89489345`)
- Prerequisites: Phase 3 (database) complete

---

## Verification Log

| Check | Status | Date |
|-------|--------|------|
| npx tsc --noEmit | PASS | Aug 30, 2026 |
| npm run build | PASS | Aug 30, 2026 |
| Auth login flow | PASS | Aug 30, 2026 |
| Route protection (proxy) | PASS | Aug 30, 2026 |
| Session management | PASS | Aug 30, 2026 |
| Sign-out flow | PASS | Aug 30, 2026 |

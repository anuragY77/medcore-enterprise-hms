# Phase Execution Plan
## MedCore Premium Enterprise Hospital Management System

**Version:** 1.0
**Date:** August 30, 2026

---

## CURRENT STATE

```
CURRENT STAGE: IMPLEMENTATION IN PROGRESS
Phase 0: COMPLETE
Phase 1: COMPLETE
Phase 2: COMPLETE
Phase 3: COMPLETE
Phase 4: COMPLETE
NEXT PHASE: Phase 5 — Patient Management & Workflows
```

---

## Phase 0 — Documentation & Project Foundation

**Objective:** Create all project documentation and initialize the Next.js project foundation.

**Why now:** Documentation must exist before any code is written. It serves as the source of truth for all subsequent phases. A new AI or developer must be able to understand the project without guessing.

**Prerequisites:** None (this is the first phase).

**Scope:**
- Create five master documentation files (PRD.md, Architecture.md, Rules.md, Phases.md, Design.md)
- Initialize Next.js 15 project with TypeScript, Tailwind CSS, App Router
- Install core dependencies (shadcn/ui, Radix UI, Zustand, TanStack Query, React Hook Form, Zod, Recharts, Lucide React)
- Configure Tailwind with DS1 Clinical Precision design tokens
- Set up ESLint and Prettier
- Create base folder structure (components, lib, hooks, stores, types)
- Set up shadcn/ui with custom MedCore theme
- Create root layout with font configuration (Plus Jakarta Sans, Inter)
- Create globals.css with DS1 token custom properties

**Routes/modules involved:** None (foundation only).

**Main implementation tasks:**
1. Create documentation files
2. `npx create-next-app@latest` with TypeScript, Tailwind, App Router
3. Install and configure shadcn/ui
4. Configure Tailwind theme with DS1 tokens
5. Set up font configuration
6. Create base folder structure
7. Initialize Drizzle with PostgreSQL config (schema placeholder)

**Key reusable components:** None yet (foundation phase).

**Backend/database work:** Drizzle config and schema placeholder only.

**Validation/testing requirements:**
- Project builds without errors (`npm run build`)
- TypeScript compiles without errors (`npx tsc --noEmit`)
- Lint passes (`npm run lint`)
- DS1 tokens render correctly in browser

**Definition of Done:**
- All five documentation files exist and are complete
- Next.js project initializes and runs
- DS1 tokens are configured in Tailwind
- Fonts load correctly
- Base folder structure exists
- No TypeScript or lint errors

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase 1 — Application Shell & Layout

**Objective:** Build the core application shell: sidebar navigation, top bar, breadcrumb, and page layout wrapper.

**Why now:** Every authenticated screen depends on the shell. It must be built first.

**Prerequisites:** Phase 0 complete.

**Scope:**
- Authenticated layout with sidebar + topbar
- Sidebar component (forest green, collapsible, navigation items)
- Top bar (search, notifications bell, user profile)
- Breadcrumb component
- Page layout wrapper (max-width 1440px, padding)
- Mobile responsive sidebar (drawer/sheet)
- Navigation constants (all module links)
- Sidebar active state highlighting

**Routes/modules involved:** Layout applies to all authenticated routes.

**Main implementation tasks:**
1. Create `AppShell` component
2. Create `Sidebar` with navigation items and active state
3. Create `TopBar` with search, notifications, profile
4. Create `Breadcrumb` component
5. Create `(dashboard)/layout.tsx` with AppShell
6. Create navigation constants file
7. Add mobile responsive sidebar using Sheet component
8. Create placeholder pages for all routes

**Key reusable components:**
- `AppShell` — wraps all authenticated pages
- `Sidebar` — navigation sidebar
- `TopBar` — top navigation bar
- `Breadcrumb` — page breadcrumb navigation

**Backend/database work:** None.

**Validation/testing requirements:**
- Sidebar renders with all navigation items
- Active route highlighting works
- TopBar renders correctly
- Breadcrumb updates per route
- Mobile sidebar opens/closes
- No TypeScript errors

**Definition of Done:**
- App shell renders on all authenticated pages
- Navigation between all routes works
- Sidebar is responsive
- Breadcrumb reflects current route

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase 2 — Authentication & Access Foundation

**Objective:** Implement login page, authentication flow, session management, and role-based access control.

**Why now:** All protected routes require authentication. This must be in place before any data-driven screen.

**Prerequisites:** Phase 1 complete (layout exists).

**Scope:**
- Login page UI (matching Stitch reference `aa1fd8bce1eb4efd8b839be8aada7bf6`)
- NextAuth v5 configuration with Credentials provider
- JWT session strategy
- Middleware for route protection
- Role-based access control utilities
- Session provider for client components
- Logout functionality
- Unauthorized redirect handling

**Routes/modules involved:** `/login`, middleware, `src/lib/auth.ts`.

**Main implementation tasks:**
1. Build Login page UI
2. Configure NextAuth with Credentials provider
3. Create auth middleware
4. Create session provider
5. Implement role-based access helpers
6. Add logout functionality
7. Test login/logout flow
8. Create basic user seed data

**Key reusable components:**
- `AuthProvider` — session context provider
- `useSession` hook — access current session
- Role check utilities

**Backend/database work:**
- Password hashing setup (bcryptjs)
- In-memory seed users for development (5 users)
- Database schema deferred to Phase 3

**Validation/testing requirements:**
- Login with valid credentials succeeds
- Login with invalid credentials shows error
- Unauthenticated access redirects to login
- Session persists across page reloads
- Role-based access blocks unauthorized routes
- Logout clears session

**Definition of Done:**
- Login page matches Stitch reference
- Authentication flow works end-to-end
- All protected routes require login
- Role-based access is enforced server-side

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase 3 — Database & Data Layer

**Objective:** Set up PostgreSQL database, Drizzle ORM schema, migrations, seed data, and migrate authentication from in-memory to database-backed.

**Why now:** A database foundation is required before building any data-driven screens. Migrating auth to PostgreSQL establishes the data layer for all subsequent phases.

**Prerequisites:** Phase 2 (auth) complete.

**Scope:**
- Install Drizzle ORM and PostgreSQL driver
- Create Drizzle configuration
- Create users table schema with UUID primary key, unique email, role validation
- Create database connection module
- Create seed script for 5 development demo users
- Generate and run versioned Drizzle migrations
- Migrate authentication from in-memory seed users to PostgreSQL-backed queries
- Validate database role values against 9 RBAC roles
- Handle avatar nullability (PostgreSQL null → JS undefined)

**Routes/modules involved:** `/login`, `src/lib/auth.ts`, `src/lib/db/`.

**Main implementation tasks:**
1. Install `drizzle-orm`, `pg`, `drizzle-kit`, `@types/pg`, `tsx`
2. Create `drizzle.config.ts`
3. Create `src/lib/db/schema.ts` (users table)
4. Create `src/lib/db/index.ts` (database connection)
5. Create `src/lib/db/seed.ts` (5 demo users)
6. Update `src/lib/auth.ts` to query PostgreSQL
7. Generate and run Drizzle migration
8. Seed database
9. Test login against database

**Key reusable components:** None (backend focus).

**Backend/database work:**
- PostgreSQL database setup
- Drizzle ORM schema (users table)
- Versioned migrations
- Seed script with bcrypt-hashed passwords
- Auth migration from in-memory to database

**Validation/testing requirements:**
- PostgreSQL connection succeeds
- Migration runs without errors
- Exactly 5 demo users are seeded
- Seed script is idempotent
- Valid login succeeds using database-backed auth
- Invalid password fails
- Role and department appear correctly in session/topbar
- Route protection still works
- Sign out still works

**Definition of Done:**
- Users table exists in PostgreSQL with correct schema
- All 5 demo users are seeded with bcrypt-hashed passwords
- Authentication queries PostgreSQL instead of in-memory data
- Login/logout flow works end-to-end against database
- Role validation prevents invalid roles from entering session

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase 4 — Hospital Operations Dashboard

**Objective:** Build the main dashboard with KPI cards, charts, and operational overview.

**Why now:** The dashboard is the landing page and primary operational view. It demonstrates the system's value immediately.

**Prerequisites:** Phase 1 (shell) and Phase 2 (auth) complete.

**Scope:**
- Dashboard page (matching Stitch reference `57eb9594c057479e9f0ebc7aac6fcc78`)
- Stats row with 4 KPI cards
- Operations overview section
- Department status cards
- Activity timeline
- Quick actions panel
- Charts (patient admissions, department utilization)

**Routes/modules involved:** `/`.

**Main implementation tasks:**
1. Create `StatsCard` component
2. Create `OperationsOverview` component
3. Create `ActivityTimeline` component
4. Create `QuickActions` component
5. Create dashboard charts with Recharts
6. Assemble dashboard page
7. Add mock data for dashboard widgets

**Key reusable components:**
- `StatsCard` — metric display card
- `OperationsOverview` — dashboard widget container
- `ActivityTimeline` — chronological event list
- `QuickActions` — action button grid

**Backend/database work:** Dashboard API endpoint aggregating data from multiple tables.

**Validation/testing requirements:**
- Dashboard matches Stitch reference
- KPI cards display correctly
- Charts render with data
- Responsive on tablet
- Loading skeletons work

**Definition of Done:**
- Dashboard visually matches canonical reference
- All widgets render with realistic data
- Charts are interactive
- Loading states work

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase 5 — Patient Management & Workflows

**Objective:** Build patient list, patient record, and patient registration screens.

**Why now:** Patients are the core entity. All clinical workflows depend on patient data.

**Prerequisites:** Phase 3 (database) complete.

**Scope:**
- Patient list page (matching reference `06c808187a414228951efbc4d8b2c27e`)
- Patient record page (matching reference `83179e75c63d4b178157081e6dc4fc35`)
- New patient registration (matching reference `6b714d4db90041ba92a7fe2a89489345`)
- Patient search with filters
- Patient table with sorting and pagination
- Patient profile card
- Patient context bar (for clinical screens)

**Routes/modules involved:** `/patients`, `/patients/new`, `/patients/[id]`.

**Main implementation tasks:**
1. Create `PatientTable` component
2. Create `PatientCard` component
3. Create `PatientBar` component (context bar)
4. Create `PatientSearch` component
5. Build patient list page
6. Build patient record page
7. Build new patient registration form
8. Create patient API endpoints
9. Create patient Zod validation schema

**Key reusable components:**
- `PatientTable` — sortable, filterable patient list
- `PatientCard` — patient profile snapshot
- `PatientBar` — compact patient context for clinical screens
- `PatientSearch` — search with autocomplete

**Backend/database work:**
- Patients table schema
- Patient allergies, conditions, medications tables
- CRUD API endpoints for patients
- Search and pagination

**Validation/testing requirements:**
- Patient list loads with pagination
- Patient search filters correctly
- Patient record shows all sections
- Registration form validates all fields
- API returns proper error responses

**Definition of Done:**
- Patient list matches canonical reference
- Patient record shows full profile
- Registration creates new patient
- Search and filter work

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase 6 — Clinical Workflows

**Objective:** Build consultation, prescription, medical records, discharge, and admission screens.

**Why now:** These are P0/P1 screens. They are the core clinical workflows that define the product's value.

**Prerequisites:** Phase 5 (patients) complete.

**Scope:**
- Doctor Consultation (matching reference `77e0cbcb07c646899e52c45798cfb93a`)
- Doctor Prescription & Orders (matching reference `d0cc602b0871494aadb4c06e9cbd9295`)
- Medical Records & Documents (matching reference `d843e7d084b64a2b9be85d3052da077b`)
- Discharge Summary (matching reference `7ff127bb2f904067a76e783460d57b24`)
- New Patient Admission (matching reference `49c93f636a144412b2d46d0836621af7`)
- Vitals card component
- Diagnosis card component
- Consultation notes form

**Routes/modules involved:** `/patients/[id]/consultation`, `/patients/[id]/prescriptions`, `/patients/[id]/records`, `/patients/[id]/discharge`, `/patients/[id]/admission`.

**Main implementation tasks:**
1. Create `ConsultationNotes` component
2. Create `VitalsCard` component
3. Create `DiagnosisCard` component
4. Create `PrescriptionForm` component
5. Create `MedicalRecordsTable` component
6. Create `DischargeForm` component
7. Build consultation page
8. Build prescriptions page
9. Build medical records page
10. Build discharge summary page
11. Build admission form page
12. Create clinical API endpoints
13. Create clinical Zod schemas

**Key reusable components:**
- `ConsultationNotes` — structured clinical notes form
- `VitalsCard` — patient vital signs display
- `DiagnosisCard` — diagnosis selection and display
- `PrescriptionForm` — medication order form
- `MedicalRecordsTable` — document list with categories
- `DischargeForm` — discharge summary form

**Backend/database work:**
- Consultations, prescriptions, medical_records, vitals tables
- Clinical API endpoints
- Admission/discharge workflow logic

**Validation/testing requirements:**
- Consultation notes save correctly
- Prescriptions create successfully
- Medical records list and filter
- Discharge summary generates
- Admission form validates all fields

**Definition of Done:**
- All 5 clinical screens match their P0/P1 references
- Forms validate and submit
- Data persists to database
- Patient context bar shows correct info

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase 7 — Staff, Doctors & Scheduling

**Objective:** Build staff management, profiles, and scheduling screens.

**Why now:** Staff management is required for doctor assignment, scheduling, and consultation workflows.

**Prerequisites:** Phase 3 (database) complete.

**Scope:**
- Doctors & Staff Management (matching reference `2614dc212ec8464aaef54d2a5aee50f0`)
- Staff Profile (matching reference `ff9990e9d6e94b329a8800ab0ddf3269`)
- Doctor Availability & Schedule (matching reference `470a5bfce19e4fe8ac446fb63e262e00`)
- Staff table with filtering
- Staff card component
- Schedule view component

**Routes/modules involved:** `/staff`, `/staff/[id]`.

**Main implementation tasks:**
1. Create `StaffTable` component
2. Create `StaffCard` component
3. Create `ScheduleView` component
4. Build staff list page
5. Build staff profile page
6. Create staff API endpoints
7. Create staff Zod schema

**Key reusable components:**
- `StaffTable` — staff directory table
- `StaffCard` — staff profile snapshot
- `ScheduleView` — availability calendar/schedule

**Backend/database work:**
- Staff table schema
- Staff API endpoints

**Validation/testing requirements:**
- Staff list loads and filters
- Staff profile shows full details
- Schedule displays correctly

**Definition of Done:**
- Staff screens match canonical references
- Staff list is searchable and filterable
- Staff profile shows complete information

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3.5-lightning-free`

---

## Phase 8 — Core Operations

**Objective:** Build appointments, departments, and beds/rooms screens.

**Why now:** These are core operational modules that support patient flow and hospital resource management.

**Prerequisites:** Phase 5 (patients), Phase 7 (staff) complete.

**Scope:**
- Appointments & Scheduling (matching reference `054d829f7cc84db1a00525daa4353b3d`)
- Appointment Details (matching reference `08e62c0238004a1ab135f0f4aa314a02`)
- New Appointment (matching reference `733131681e534504a2235524f528455b`)
- Departments & Units (matching reference `a55806e461bf43f0ac1d6bc4a7077bb1`)
- Department Details (matching reference `a5d0f64eb3914a52946aed3dd2e1acb9`)
- Beds & Rooms Management (matching reference `608f91df6ecd42e1b36bc0102a54cbc6`)

**Routes/modules involved:** `/appointments`, `/appointments/[id]`, `/departments`, `/departments/[id]`, `/beds`.

**Main implementation tasks:**
1. Create `BedGrid` component
2. Create `RoomStatus` component
3. Build appointment list page
4. Build appointment details page
5. Build new appointment form
6. Build departments page
7. Build department details page
8. Build beds & rooms page
9. Create API endpoints for all modules

**Key reusable components:**
- `BedGrid` — bed occupancy grid
- `RoomStatus` — room status indicators

**Backend/database work:**
- Appointments, departments, beds tables
- API endpoints

**Validation/testing requirements:**
- Appointments list loads and filters
- Appointment creation works
- Department list displays
- Bed grid shows occupancy

**Definition of Done:**
- All 3 module screens match canonical references
- CRUD operations work
- Data persists correctly

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3.5-lightning-free`

---

## Phase 9 — Support & Clinical Operations

**Objective:** Build pharmacy, laboratory, billing, insurance, and inventory screens.

**Why now:** These support modules complete the operational picture and are required for end-to-end workflows.

**Prerequisites:** Phase 5 (patients) complete.

**Scope:**
- Pharmacy Management (matching reference `7350e94a841d49f383ff40bdbb8c722c`)
- Laboratory & Diagnostics (matching reference `fe1d646d4f2b426792af7ee7b78c50ea`)
- Billing & Payments (matching reference `4c8d1d1b0c48477db5a0b6315210d54f`)
- Insurance & Claims (matching reference `120b8110231c496b984bfbcc32d9dae9`)
- Inventory Management (matching reference `172038fc7b984f36b5d31f511781f8b8`)

**Routes/modules involved:** `/pharmacy`, `/laboratory`, `/billing`, `/insurance`, `/inventory`.

**Main implementation tasks:**
1. Build pharmacy page
2. Build laboratory page
3. Build billing page
4. Build insurance page
5. Build inventory page
6. Create API endpoints for all modules
7. Create Zod schemas for all modules

**Key reusable components:** Existing shared components (`DataTable`, `PageHeader`, `StatsRow`, `FilterBar`, `StatusBadge`).

**Backend/database work:**
- Pharmacy, laboratory, billing, insurance, inventory tables
- API endpoints

**Validation/testing requirements:**
- All 5 pages render correctly
- Data tables load and filter
- Forms validate and submit

**Definition of Done:**
- All support module screens match canonical references
- CRUD operations work
- Data persists correctly

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3.5-lightning-free`

---

## Phase 10 — Specialized Operations

**Objective:** Build nursing, surgery, emergency, and notification screens.

**Why now:** These specialized modules serve specific departments and complete the operational scope.

**Prerequisites:** Phase 5 (patients), Phase 7 (staff), Phase 8 (operations) complete.

**Scope:**
- Nurse Station Dashboard (matching reference `4f63da3aaa9a4a14bda59af5e79b9ca3`)
- Surgery & OT Schedule (matching reference `261d8d74080741b9b4d05587f0e6115a`)
- Emergency Command Center (matching reference `f3cf7efa0b684a3ab53db975f8b81900`)
- Notifications & Communication (matching reference `fc980b9e994844df9c9cf2e5f1b4f86f`)

**Routes/modules involved:** `/nursing`, `/surgery`, `/emergency`, `/notifications`.

**Main implementation tasks:**
1. Build nurse station dashboard
2. Build surgery & OT schedule
3. Build emergency command center
4. Build notifications page
5. Create API endpoints

**Key reusable components:** Existing shared components.

**Backend/database work:**
- Surgeries, notifications tables
- API endpoints

**Validation/testing requirements:**
- All 4 pages render correctly
- Data loads properly
- Actions work

**Definition of Done:**
- All specialized screens match references
- Data flows correctly

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3.5-lightning-free`

---

## Phase 11 — Administration

**Objective:** Build security audit log, settings, users & roles, and reports screens.

**Why now:** Administrative modules are lower priority but required for complete product.

**Prerequisites:** Phase 3 (database) complete.

**Scope:**
- Security Audit Log (matching reference `b45ffa972b2249ceb8ecfc5f34475bc0`)
- Settings & Administration (matching reference `c80cd8180d024f0097e7a93b16517196`)
- Users & Roles Administration (matching reference `16fab73369a94268afd72416ffae0cff`)
- Reports & Analytics (matching reference `fb4e8fba80e846139bca1494d78bf6f4`)

**Routes/modules involved:** `/security`, `/settings`, `/users`, `/reports`.

**Main implementation tasks:**
1. Build security audit log page
2. Build settings page
3. Build users & roles page
4. Build reports page
5. Create API endpoints

**Key reusable components:** Existing shared components.

**Backend/database work:**
- Audit logs, users tables
- API endpoints

**Validation/testing requirements:**
- All 4 pages render correctly
- Audit log shows events
- User management works

**Definition of Done:**
- All admin screens match references
- CRUD operations work

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3.5-lightning-free`

---

## Phase 12 — Backend Completion & Database Integration

**Objective:** Complete all API endpoints, database migrations, seed data, and integration testing.

**Why now:** Frontend screens are built; backend must be fully integrated for production readiness.

**Prerequisites:** Phases 3-11 complete (database foundation and all screens built).

**Scope:**
- Complete all remaining API endpoints
- Run all database migrations
- Create comprehensive seed data
- Integration testing across all modules
- API error handling completion
- Data validation completion

**Routes/modules involved:** All `/api/*` routes.

**Main implementation tasks:**
1. Audit all API endpoints for completeness
2. Run all Drizzle migrations
3. Create seed script with realistic data
4. Test all CRUD operations
5. Test all clinical workflows
6. Fix any integration issues

**Key reusable components:** None (backend focus).

**Backend/database work:**
- All remaining migrations
- Comprehensive seed data
- Integration testing

**Validation/testing requirements:**
- All API endpoints respond correctly
- All CRUD operations work
- Clinical workflows function end-to-end
- No database errors

**Definition of Done:**
- All API endpoints complete and tested
- Database fully migrated and seeded
- Integration tests pass

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase 13 — Testing, Responsiveness & Polish

**Objective:** Final quality pass: accessibility, responsive design, error handling, performance, and polish.

**Why now:** Final phase ensures production readiness across all quality dimensions.

**Prerequisites:** Phase 12 complete.

**Scope:**
- Accessibility audit and fixes (WCAG 2.1 AA)
- Responsive design testing (desktop, tablet, mobile)
- Error boundary implementation
- Loading state consistency
- Empty state consistency
- Performance optimization
- Final visual polish
- Cross-browser testing

**Routes/modules involved:** All routes.

**Main implementation tasks:**
1. Accessibility audit with automated tools
2. Responsive testing on all breakpoints
3. Error boundary verification
4. Loading state verification
5. Empty state verification
6. Performance audit (Lighthouse)
7. Visual polish pass
8. Final bug fixes

**Key reusable components:** Existing components updated for accessibility.

**Backend/database work:** None.

**Validation/testing requirements:**
- Lighthouse score > 90
- No accessibility violations
- Responsive on all breakpoints
- All error states work
- All loading states work

**Definition of Done:**
- All screens pass accessibility checks
- Responsive on desktop, tablet, mobile
- Performance targets met
- No known bugs

**Recommended model:** `opencode/mimo-v2.5-free`
**Backup model:** `opencode/nemotron-3-ultra-free`

---

## Phase Summary

| Phase | Name | Key Screens | Dependencies |
|-------|------|-------------|--------------|
| 0 | Documentation & Foundation | 0 | None |
| 1 | Application Shell | 0 | Phase 0 |
| 2 | Authentication | Login | Phase 1 |
| 3 | Database & Data Layer | 0 | Phase 2 |
| 4 | Dashboard | 1 PRIMARY | Phase 1, 2 |
| 5 | Patient Management | 3 screens | Phase 3 |
| 6 | Clinical Workflows | 5 P0/P1 screens | Phase 5 |
| 7 | Staff & Scheduling | 3 screens | Phase 3 |
| 8 | Core Operations | 6 screens | Phase 5, 7 |
| 9 | Support Operations | 5 screens | Phase 5 |
| 10 | Specialized Operations | 4 screens | Phase 5, 7, 8 |
| 11 | Administration | 4 screens | Phase 3 |
| 12 | Backend Completion | All APIs | Phases 3-11 |
| 13 | Testing & Polish | All screens | Phase 12 |

**Total unique routes:** ~35
**Total phases:** 14 (0-13)

---

*This document is the implementation roadmap. Follow the phases in order. Do not skip ahead without dependency-based justification.*

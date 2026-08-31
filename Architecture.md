# Technical Architecture
## MedCore Premium Enterprise Hospital Management System

**Version:** 1.0
**Date:** August 30, 2026
**Status:** Pre-Coding Documentation

---

## 1. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15+ (App Router) | Server components, file-based routing, API routes in one runtime |
| Language | TypeScript | Type safety across 35+ screens, shared schemas |
| Styling | Tailwind CSS v4 | Utility-first, maps directly to DS1 design tokens |
| UI Primitives | Radix UI | Accessible, unstyled components for customization |
| Component Kit | shadcn/ui | Built on Radix, customizable, copy-paste model |
| Client State | Zustand | Lightweight, minimal boilerplate |
| Server State | TanStack Query | Caching, pagination, optimistic updates |
| Forms | React Hook Form | Performant, controlled/uncontrolled support |
| Validation | Zod | Shared client/server schemas, TypeScript inference |
| Charts | Recharts | Dashboard visualizations, composable |
| Icons | Lucide React | Consistent, tree-shakeable icon set |
| Backend Runtime | Node.js (via Next.js) | Single runtime, no separate server |
| API | Next.js Route Handlers | REST endpoints colocated with frontend |
| Auth | NextAuth v5 | Enterprise SSO-ready, session management |
| ORM | Drizzle ORM | Type-safe, SQL-like, lightweight |
| Database | PostgreSQL | Enterprise-grade, relational, ACID |
| Migrations | Drizzle Kit | Schema-driven, version-controlled |
| Package Manager | npm | Pre-installed in environment |
| Linting | ESLint | Code quality enforcement |
| Formatting | Prettier | Consistent code style |
| Git Hooks | Husky + lint-staged | Pre-commit validation |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                     │
│  Next.js React App + Tailwind + shadcn/ui + Zustand     │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/HTTPS
┌─────────────────────▼───────────────────────────────────┐
│                Next.js Server (SSR/API)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  App Router   │  │ Route        │  │  Middleware   │  │
│  │  (Pages)      │  │ Handlers     │  │  (Auth)      │  │
│  └──────────────┘  └──────┬───────┘  └──────────────┘  │
│                           │                              │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │              Drizzle ORM                          │  │
│  └────────────────────────┬──────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                     PostgreSQL                          │
│  Tables: users, patients, staff, admissions,             │
│  consultations, prescriptions, records, vitals,          │
│  appointments, departments, beds, surgeries, etc.        │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

### 3.1 Rendering Strategy

| Route Type | Rendering | Example |
|------------|-----------|---------|
| Public pages | Client-side | `/login` |
| Dashboard | Server + Client | `/` (server data, client interactivity) |
| List views | Server + Client | `/patients` (server fetch, client pagination) |
| Detail views | Server + Client | `/patients/[id]` |
| Forms | Client-side | `/patients/[id]/admission` |
| API routes | Server-only | `/api/patients` |

### 3.2 Component Architecture

```
Root Layout
├── AuthProvider (NextAuth session)
├── QueryProvider (TanStack Query)
├── ThemeProvider (Tailwind)
└── AppShell (if authenticated)
    ├── Sidebar (forest green, fixed 256px)
    ├── TopBar (search, notifications, profile)
    └── MainContent (fluid, max 1440px)
        ├── Breadcrumb
        ├── PageHeader (title, subtitle, actions)
        └── PageContent (varies per route)
```

---

## 4. App Router Routing Architecture

### 4.1 Route Groups

```
src/app/
├── (auth)/                    # Unauthenticated routes
│   ├── login/page.tsx
│   └── layout.tsx
├── (dashboard)/               # Authenticated routes
│   ├── layout.tsx             # AppShell with sidebar
│   ├── page.tsx               # Dashboard
│   ├── patients/...
│   ├── staff/...
│   └── ...
└── api/                       # API Route Handlers
    ├── auth/...
    ├── patients/...
    └── ...
```

### 4.2 Complete Route Map

| Route | Screen | Module |
|-------|--------|--------|
| `/login` | Login & Authentication | Auth |
| `/` | Hospital Operations Dashboard | Dashboard |
| `/patients` | Patient Management | Patients |
| `/patients/new` | New Patient Registration | Patients |
| `/patients/[id]` | Patient Record | Patients |
| `/patients/[id]/admission` | New Patient Admission | Patients |
| `/patients/[id]/consultation` | Doctor Consultation | Clinical |
| `/patients/[id]/prescriptions` | Doctor Prescription & Orders | Clinical |
| `/patients/[id]/records` | Medical Records & Documents | Clinical |
| `/patients/[id]/discharge` | Discharge Summary | Clinical |
| `/staff` | Doctors & Staff Management | Staff |
| `/staff/[id]` | Staff Profile | Staff |
| `/appointments` | Appointments & Scheduling | Appointments |
| `/appointments/[id]` | Appointment Details | Appointments |
| `/departments` | Departments & Units | Departments |
| `/departments/[id]` | Department Details | Departments |
| `/beds` | Beds & Rooms Management | Beds |
| `/pharmacy` | Pharmacy Management | Pharmacy |
| `/laboratory` | Laboratory & Diagnostics | Lab |
| `/billing` | Billing & Payments | Billing |
| `/insurance` | Insurance & Claims | Insurance |
| `/inventory` | Inventory Management | Inventory |
| `/nursing` | Nurse Station Dashboard | Nursing |
| `/surgery` | Surgery & OT Schedule | Surgery |
| `/emergency` | Emergency Command Center | Emergency |
| `/notifications` | Notifications & Communication | Notifications |
| `/reports` | Reports & Analytics | Reports |
| `/security` | Security Audit Log | Security |
| `/settings` | Settings & Administration | Admin |
| `/users` | Users & Roles Administration | Admin |

---

## 5. Folder and File Structure

```
hms/
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── patients/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── admission/page.tsx
│   │   │   │       ├── consultation/page.tsx
│   │   │   │       ├── prescriptions/page.tsx
│   │   │   │       ├── records/page.tsx
│   │   │   │       └── discharge/page.tsx
│   │   │   ├── staff/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── appointments/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── departments/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── beds/page.tsx
│   │   │   ├── pharmacy/page.tsx
│   │   │   ├── laboratory/page.tsx
│   │   │   ├── billing/page.tsx
│   │   │   ├── insurance/page.tsx
│   │   │   ├── inventory/page.tsx
│   │   │   ├── nursing/page.tsx
│   │   │   ├── surgery/page.tsx
│   │   │   ├── emergency/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── security/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── users/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── patients/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── staff/route.ts
│   │   │   ├── appointments/route.ts
│   │   │   └── ...
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── toast.tsx
│   │   │   └── sheet.tsx
│   │   ├── layout/
│   │   │   ├── app-shell.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   └── mobile-nav.tsx
│   │   ├── patients/
│   │   │   ├── patient-bar.tsx
│   │   │   ├── patient-card.tsx
│   │   │   ├── patient-table.tsx
│   │   │   ├── patient-form.tsx
│   │   │   └── patient-search.tsx
│   │   ├── clinical/
│   │   │   ├── consultation-notes.tsx
│   │   │   ├── vitals-card.tsx
│   │   │   ├── diagnosis-card.tsx
│   │   │   ├── prescription-form.tsx
│   │   │   ├── medical-records-table.tsx
│   │   │   └── discharge-form.tsx
│   │   ├── dashboard/
│   │   │   ├── stats-card.tsx
│   │   │   ├── operations-overview.tsx
│   │   │   ├── activity-timeline.tsx
│   │   │   └── quick-actions.tsx
│   │   ├── staff/
│   │   │   ├── staff-table.tsx
│   │   │   ├── staff-card.tsx
│   │   │   └── schedule-view.tsx
│   │   ├── beds/
│   │   │   ├── bed-grid.tsx
│   │   │   └── room-status.tsx
│   │   └── shared/
│   │       ├── data-table.tsx
│   │       ├── page-header.tsx
│   │       ├── stats-row.tsx
│   │       ├── filter-bar.tsx
│   │       ├── status-badge.tsx
│   │       ├── empty-state.tsx
│   │       └── loading-state.tsx
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── validations/
│   │   │   ├── patient.ts
│   │   │   ├── staff.ts
│   │   │   ├── appointment.ts
│   │   │   └── prescription.ts
│   │   └── constants.ts
│   ├── hooks/
│   │   ├── use-patients.ts
│   │   ├── use-staff.ts
│   │   └── use-appointments.ts
│   ├── stores/
│   │   ├── auth-store.ts
│   │   └── sidebar-store.ts
│   └── types/
│       ├── patient.ts
│       ├── staff.ts
│       └── appointment.ts
├── drizzle/
│   └── migrations/
├── docs/
│   └── Memory.md
├── PRD.md
├── Architecture.md
├── Rules.md
├── Phases.md
├── Design.md
├── .env.local
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

> **Note:** This is a target architecture. Folders and files should be created progressively during implementation, not all at once.

---

## 6. Component Architecture

### 6.1 Shared Component Strategy

Components in `src/components/shared/` are used across multiple modules:

| Component | Purpose | Used By |
|-----------|---------|---------|
| `DataTable` | Generic sortable/filterable table | All list views |
| `PageHeader` | Title + subtitle + action buttons | All pages |
| `StatsRow` | Row of metric cards | Dashboard, module overviews |
| `FilterBar` | Search + dropdown filters | All list views |
| `StatusBadge` | Colored status indicator | All tables and cards |
| `EmptyState` | No-data illustration | All list views |
| `LoadingState` | Skeleton/spinner | All async views |

### 6.2 Module Component Strategy

Each module has its own component directory:

| Module | Components |
|--------|------------|
| Patients | `PatientBar`, `PatientCard`, `PatientTable`, `PatientForm`, `PatientSearch` |
| Clinical | `ConsultationNotes`, `VitalsCard`, `DiagnosisCard`, `PrescriptionForm`, `MedicalRecordsTable`, `DischargeForm` |
| Dashboard | `StatsCard`, `OperationsOverview`, `ActivityTimeline`, `QuickActions` |
| Staff | `StaffTable`, `StaffCard`, `ScheduleView` |
| Beds | `BedGrid`, `RoomStatus` |

### 6.3 Component Composition Pattern

Every screen follows:

```tsx
<PageLayout>
  <PageHeader title="..." subtitle="..." actions={[...]} />
  <StatsRow stats={[...]} />  {/* optional */}
  <ContentGrid columns={2}>
    <Card>
      <CardHeader>...</CardHeader>
      <CardContent>
        <DataTable columns={...} data={...} />
      </CardContent>
    </Card>
    <Sidebar>
      <Card>...</Card>  {/* optional */}
    </Sidebar>
  </ContentGrid>
</PageLayout>
```

---

## 7. State Management Strategy

### 7.1 Client State (Zustand)

| Store | Purpose |
|-------|---------|
| `auth-store.ts` | User session, role, permissions |
| `sidebar-store.ts` | Sidebar open/collapsed state |

Zustand is used sparingly — only for truly client-side state that doesn't come from the server.

### 7.2 Server State (TanStack Query)

All data fetching, caching, and mutations use TanStack Query:

```typescript
// Fetch patients list
const { data, isLoading } = useQuery({
  queryKey: ['patients', page, filters],
  queryFn: () => fetchPatients(page, filters),
});

// Mutate patient
const mutation = useMutation({
  mutationFn: updatePatient,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  },
});
```

### 7.3 Form State (React Hook Form + Zod)

```typescript
const form = useForm<PatientInput>({
  resolver: zodResolver(patientSchema),
  defaultValues: { ... },
});
```

---

## 8. API Architecture

### 8.1 REST Conventions

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/patients` | List with pagination, search, filters |
| POST | `/api/patients` | Create new patient |
| GET | `/api/patients/[id]` | Get patient by ID |
| PUT | `/api/patients/[id]` | Update patient |
| DELETE | `/api/patients/[id]` | Delete patient |
| GET | `/api/patients/[id]/records` | Get patient records |
| POST | `/api/patients/[id]/admission` | Admit patient |

### 8.2 API Response Format

```typescript
// Success
{ "data": T, "meta": { "page": 1, "total": 100, "limit": 20 } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

### 8.3 API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

### 8.4 Validation Strategy

All API inputs validated with Zod:

```typescript
// Shared schema (client + server)
export const patientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(10),
  dob: z.string().date(),
  gender: z.enum(['Male', 'Female', 'Other']),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
});

export type PatientInput = z.infer<typeof patientSchema>;
```

---

## 9. Authentication Architecture

### 9.1 Implementation

- NextAuth v5 with Credentials provider (email/password)
- JWT-based sessions (no database session storage for simplicity)
- Middleware-level route protection

### 9.2 Proxy (Route Protection)

Route protection is handled by `src/proxy.ts` (Next.js 16 convention, replaces `middleware.ts`):

```typescript
// src/proxy.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes: allow without auth, redirect away if logged in
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes: redirect to /login with callbackUrl if not logged in
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 9.3 Session Shape

```typescript
{
  user: {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST' | 'PHARMACIST' | 'LAB_TECHNICIAN' | 'BILLING' | 'SURGEON' | 'SECURITY';
    department: string;
    avatar?: string;
  }
}
```

---

## 10. Authorization and Role Strategy

### 10.1 Role Permissions

| Role | Dashboard | Patients | Clinical | Admin | Reports |
|------|-----------|----------|----------|-------|---------|
| Admin | Full | Full | Read | Full | Full |
| Doctor | Read | Full | Full | None | Own |
| Nurse | Read | Read | Limited | None | None |
| Receptionist | Read | Create/Edit | None | None | None |
| Pharmacist | Read | Read | Read Rx | None | None |
| Lab Tech | Read | Read | Read Lab | None | None |
| Billing | Read | Read | None | Billing | Billing |
| Surgeon | Read | Full | Full | None | Own |
| Security | Read | Read | None | Audit | Audit |

### 10.2 Implementation

Server-side enforcement in API routes:

```typescript
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'DOCTOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ... fetch data
}
```

---

## 11. Database Architecture

### 11.1 Major Database Entities

```
users ──────────┐
                │
patients ───────┼── admissions
                ├── consultations
                ├── prescriptions
                ├── medical_records
                ├── vitals
                └── appointments
                
staff ──────────┬── consultations (as physician)
                ├── prescriptions (as physician)
                └── surgeries (as surgeon)

departments ────┬── beds
                ├── staff
                └── admissions

beds ──────────── admissions (current)

surgeries ────── patients, staff (surgeon)

audit_logs ───── users
```

### 11.2 Drizzle Structure

```typescript
// src/lib/db/schema.ts
import { pgTable, uuid, varchar, timestamp, ... } from 'drizzle-orm/pg-core';

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  mrn: varchar('mrn', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  dob: timestamp('dob'),
  gender: varchar('gender', { length: 10 }),
  bloodGroup: varchar('blood_group', { length: 5 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow(),
  // ...
});
```

### 11.3 Drizzle Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## 12. Data Flow

### 12.1 Page Load Flow

```
Browser requests /patients
→ Next.js middleware checks auth
→ Server component renders with data
→ Page sent to browser with initial data
→ Client hydration with TanStack Query
→ User interactions trigger client-side fetches
```

### 12.2 Form Submission Flow

```
User fills form
→ React Hook Form validates (Zod)
→ Client-side validation passes
→ TanStack Query mutation fires
→ API route receives request
→ Zod validates server-side
→ Drizzle inserts to PostgreSQL
→ Response returned
→ Query cache invalidated
→ UI updates
```

---

## 13. Error Handling Architecture

### 13.1 Frontend Error Boundaries

```typescript
// src/app/error.tsx
'use client';
export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### 13.2 API Error Handling

```typescript
// src/lib/api-error.ts
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}
```

### 13.3 Toast Notifications

All async operations show toast notifications for success/failure using the shadcn/ui toast system.

---

## 14. Loading and Empty States

### 14.1 Loading Strategy

| Context | Loading State |
|---------|---------------|
| Page load | Skeleton with realistic dimensions |
| Table data | Skeleton rows (5-10 rows) |
| Form submission | Button spinner + disabled state |
| Chart data | Chart skeleton placeholder |
| Card data | Card skeleton with shimmer |

### 14.2 Empty States

Every list view has an empty state when no data exists:

```tsx
<EmptyState
  title="No patients found"
  description="No patients match your current filters."
  action={{ label: "Register Patient", onClick: () => router.push('/patients/new') }}
/>
```

---

## 15. Environment Variable Strategy

```env
# .env.local
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_URL=http://localhost:3000
```

All secrets via environment variables. No hardcoded values. `.env.local` is gitignored.

---

## 16. Testing Strategy

| Level | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | Utility functions, validators |
| Component | Vitest + Testing Library | Reusable components |
| Integration | Vitest | API routes, data flows |
| E2E | Playwright (future) | Critical user journeys |
| Type | TypeScript compiler | All code |

---

## 17. Scalability Considerations

- Server components reduce client bundle size
- TanStack Query caching reduces redundant API calls
- Database indexing on frequently queried fields (patient MRN, staff ID)
- Pagination on all list views (20 items default)
- Lazy loading for non-critical modules
- Image optimization via Next.js Image component

---

*This document is the technical architecture source of truth. Implementation must follow these patterns.*

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
| **20** | **50** | **32** | **22** | **9** |
| [Modules](#modules) | API Routes | Pages | DB Tables | RBAC Roles |
| **77** | **41** | **953** | **0** |
| Components | Permission Keys | Automated Checks | Build Errors |

</div>

---

## 🎯 Why MedCore?

Most portfolio HMS projects stop at CRUD screens with fake data. MedCore goes further:

- **🔒 Real security** — every API is authenticated and permission-checked server-side; UI gating is a convenience, the backend is the source of truth.
- **🔁 Real workflows** — admit → assign bed → occupy → discharge → release, with transactional integrity, deadlock-safe locking, and audit trails.
- **🧾 Real billing** — invoices, payments, insurance claims, approvals — computed from actual line items, never hard-coded.
- **🧪 Really tested** — 953 automated checks across 9 suites (API contracts, RBAC matrices, DB integrity, concurrency races, static source gates), plus strict `tsc`, ESLint, and production build gates.
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
| 6 | 🛏️ **Beds & Rooms** | **Inpatient lifecycle: admission → assignment → occupancy → discharge → release** |
| 7 | 💗 **Nursing** | Ward patient board, task queue, live shift metrics, quick actions |
| 8 | 💊 **Pharmacy** | Inventory, prescriptions, dispensing workflow |
| 9 | 🧪 **Laboratory** | Orders, results, processing → completion pipeline |
| 10 | 🔬 **Surgery** | OT scheduling, procedure planning |
| 11 | 🚨 **Emergency** | Triage, acuity levels, command center |
| 12 | 💳 **Billing** | Invoices, line items, payments, totals |
| 13 | 🛡️ **Insurance** | Claims, approval workflow, coverage |
| 14 | 📦 **Inventory** | Stock tracking, levels, alerts |
| 15 | 📁 **Records** | Cross-patient records hub with relational details |
| 16 | 🔔 **Notifications** | Per-user inbox |
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
    D --> E[📤 Discharge<br/>status = Discharged<br/>audit: patient.discharge]
    E --> F[✅ Available<br/>bed released in same TX<br/>audit: bed.release]
    F -.->|reusable| C
```

**Guarantees:**
- ♟️ **Deadlock-safe** — consistent lock order: patient row → bed row
- 🚫 **Double-booking impossible** — concurrent assign races resolve to exactly one `200` + one `409`
- 📏 **Single source of truth** — `beds.patient_id` ⇄ `beds.status` consistency validated in every write path
- 📜 **Append-only audit** — safe identifiers only, never clinical text
- ⚖️ **Occupancy cannot be overwritten** via generic `PUT` — workflow endpoints only

---

## ✅ Quality Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ Pass — strict TypeScript, zero errors |
| `npm run lint` | ✅ Pass — 0 errors |
| `npm run build` | ✅ Pass — production build |
| **9 test suites** | ✅ **953 / 953 checks green** |
| — API contract suites | auth, records, beds, pharmacy, lab, surgery, emergency, billing |
| — Concurrency tests | parallel assign/discharge races → deterministic outcomes |
| — DB integrity tests | occupancy invariants, orphan checks, cascade cleanup |
| — Static source gates | no `console.log`, no fake delays, no mock data in shipped pages |
| **Schema discipline** | ✅ No migration without an approved gate |

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
npx tsx src/lib/db/seed.ts

# 5. Launch
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** 🎉

### 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| 🛡️ Admin | `admin@medcore.com` | `medcore123` |
| 🩺 Doctor | `doctor@medcore.com` | `medcore123` |
| 💗 Nurse | `nurse@medcore.com` | `medcore123` |
| 🙋 Reception | `reception@medcore.com` | `medcore123` |
| 💊 Pharmacy | `pharmacy@medcore.com` | `medcore123` |

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
│   └── api/                    # ⚡ 50 route handlers (RBAC + validation)
├── components/                 # 🧩 77 reusable components
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
- [ ] Notification delivery engine
- [ ] Payment gateway integration
- [ ] External HL7/FHIR integrations

---

## 📜 License

Private — All rights reserved.

---

<div align="center">

**Built with obsessive attention to correctness — every claim in this README is enforced by a test.**

`★ Star the repo if you find it impressive` · [Report an issue](https://github.com/anuragY77/medcore-enterprise-hms/issues)

</div>

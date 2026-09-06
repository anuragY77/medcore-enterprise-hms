# MedCore Premium Enterprise Hospital Management System

A production-ready, full-stack Hospital Management System built with Next.js 16, TypeScript, Tailwind CSS v4, and PostgreSQL.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 + Radix UI
- **State:** Zustand + TanStack Query
- **Forms:** React Hook Form + Zod 4
- **Database:** PostgreSQL 18 + Drizzle ORM
- **Auth:** NextAuth v5 (Credentials provider, JWT)
- **Charts:** Recharts
- **Icons:** Lucide React

## Features

- Role-based access control (9 roles: Admin, Doctor, Nurse, Receptionist, Pharmacist, Lab Technician, Billing, Surgeon, Security)
- Patient management with allergies, conditions, and medications tracking
- Clinical workflows: consultations, prescriptions, medical records, vitals
- Staff management and scheduling
- Appointments, departments, and bed management
- Pharmacy and inventory management
- Laboratory and diagnostics
- Billing, invoicing, and insurance claims
- Surgery and operating theater scheduling
- Emergency department command center with triage management
- Responsive design with dark/light mode support

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 16+

### Setup

1. Clone the repository:
```bash
git clone https://github.com/anuragY77/medcore-enterprise-hms.git
cd medcore-enterprise-hms
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your database credentials
```

4. Run database migrations:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

5. Seed the database:
```bash
npx tsx src/lib/db/seed.ts
```

6. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Authenticated dashboard
│   │   ├── patients/          # Patient management
│   │   ├── consultations/     # Clinical workflows
│   │   ├── appointments/      # Scheduling
│   │   ├── staff/             # Staff management
│   │   ├── pharmacy/          # Pharmacy management
│   │   ├── laboratory/        # Lab & diagnostics
│   │   ├── billing/           # Invoicing
│   │   ├── insurance/         # Claims management
│   │   ├── inventory/         # Inventory tracking
│   │   ├── surgery/           # OT scheduling
│   │   ├── emergency/         # Emergency command center
│   │   ├── departments/       # Department management
│   │   └── beds/              # Bed management
│   └── api/                   # API route handlers
├── components/                # Reusable UI components
├── lib/
│   ├── auth.ts                # NextAuth configuration
│   ├── db/                    # Drizzle ORM schema & connection
│   ├── validations/           # Zod validation schemas
│   └── constants.ts           # Navigation & app constants
└── types/                     # TypeScript type definitions
```

## Database

The system uses PostgreSQL with Drizzle ORM for type-safe database access. The schema includes 20 tables covering patients, staff, clinical records, pharmacy, laboratory, billing, insurance, inventory, surgery, and emergency management.

## License

Private - All rights reserved.

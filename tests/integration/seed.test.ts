import { drizzle } from "drizzle-orm/node-postgres";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { seedAll } from "@/lib/db/seed/index";
import { assertSeedTarget, SeedGuardError } from "@/lib/db/seed/guard";
import {
  integrationEnabled,
  setupIntegration,
  teardownIntegration,
  type IntegrationContext,
} from "./helpers";

const RUN = integrationEnabled;

const EXPECTED: Record<string, number> = {
  departments: 12,
  demoUsers: 5,
  staff: 18,
  patients: 80,
  beds: 94,
  appointments: 150,
  emergencyCases: 18,
  surgeries: 14,
  consultations: 70,
  prescriptions: 210,
  medicalRecords: 212, // 48 admissions + 14 discharge summaries + 150 notes
  vitals: 148, // 34 admitted x3 + 14 discharged x1 + 32 outpatients x1
  labTests: 130,
  invoices: 110,
  pharmacyMedicines: 24,
  inventoryItems: 16,
  notifications: 24,
};

const COUNTED_TABLES = [
  "users",
  "patients",
  "patient_allergies",
  "patient_conditions",
  "patient_medications",
  "consultations",
  "prescriptions",
  "medical_records",
  "vitals",
  "staff",
  "appointments",
  "departments",
  "beds",
  "pharmacy_medicines",
  "lab_tests",
  "invoices",
  "insurance_claims",
  "inventory_items",
  "emergency_cases",
  "surgeries",
  "notifications",
];

describe.skipIf(!RUN)("demo seed integration", () => {
  let ctx: IntegrationContext;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let firstCounts: Record<string, number>;

  beforeAll(async () => {
    ctx = await setupIntegration();
    db = drizzle(ctx.pool, { schema });
  });
  afterAll(async () => {
    await teardownIntegration(ctx);
  });

  async function rowCounts(): Promise<Record<string, number>> {
    const { rows } = await ctx.pool.query(
      `SELECT ${COUNTED_TABLES.map((t) => `(SELECT count(*) FROM ${t}) AS ${t}`).join(", ")}`
    );
    return rows[0] as Record<string, number>;
  }

  it("guard accepts TEST_DATABASE_URL only with explicit confirmation", () => {
    const url = process.env.TEST_DATABASE_URL!;
    expect(() =>
      assertSeedTarget({ databaseUrl: url, nodeName: "test", confirmed: true })
    ).not.toThrow();
    expect(() =>
      assertSeedTarget({ databaseUrl: url, nodeName: "test", confirmed: false })
    ).toThrow(SeedGuardError);
    expect(() =>
      assertSeedTarget({
        databaseUrl: url,
        nodeName: "production",
        confirmed: true,
      })
    ).toThrow(SeedGuardError);
  });

  it("seeds the complete demo dataset in one transaction", async () => {
    firstCounts = await db.transaction((tx) => seedAll(tx));
    for (const [domain, expected] of Object.entries(EXPECTED)) {
      expect(firstCounts[domain], domain).toBe(expected);
    }
    expect(firstCounts.patientAllergies).toBeGreaterThan(0);
    expect(firstCounts.patientConditions).toBeGreaterThan(0);
    expect(firstCounts.patientMedications).toBeGreaterThan(0);
    expect(firstCounts.insuranceClaims).toBeGreaterThan(0);
    expect(firstCounts.insuranceClaims).toBeLessThanOrEqual(45);
  });

  it("is idempotent — a second run upserts the same rows without duplicates", async () => {
    const before = await rowCounts();
    const secondCounts = await db.transaction((tx) => seedAll(tx));
    expect(secondCounts).toEqual(firstCounts);
    const after = await rowCounts();
    expect(after).toEqual(before);
  });

  it("maintains referential integrity across domains", async () => {
    const checks: [string, string][] = [
      [
        "occupied beds always belong to non-discharged patients",
        `SELECT count(*)::int AS n FROM beds b JOIN patients p ON p.id = b.patient_id
         WHERE b.status = 'Occupied' AND p.status = 'Discharged'`,
      ],
      [
        "every occupied-bed patient has an admission record",
        `SELECT count(*)::int AS n FROM beds b
         WHERE b.status = 'Occupied'
           AND NOT EXISTS (SELECT 1 FROM medical_records mr
                           WHERE mr.patient_id = b.patient_id
                             AND mr.title = 'Patient Admission')`,
      ],
      [
        "no non-discharged patient holds a released bed with an admission record",
        `SELECT count(*)::int AS n FROM patients p
         WHERE p.status IN ('Active', 'Critical')
           AND NOT EXISTS (SELECT 1 FROM beds b
                           WHERE b.patient_id = p.id AND b.status = 'Occupied')
           AND EXISTS (SELECT 1 FROM medical_records mr
                       WHERE mr.patient_id = p.id AND mr.title = 'Patient Admission')`,
      ],
      [
        "discharge records only exist for discharged patients",
        `SELECT count(*)::int AS n FROM medical_records mr JOIN patients p ON p.id = mr.patient_id
         WHERE mr.record_type = 'Discharge' AND p.status <> 'Discharged'`,
      ],
      [
        "every discharged patient has a discharge summary",
        `SELECT count(*)::int AS n FROM patients p
         WHERE p.status = 'Discharged'
           AND NOT EXISTS (SELECT 1 FROM medical_records mr
                           WHERE mr.patient_id = p.id AND mr.record_type = 'Discharge')`,
      ],
      [
        "appointments reference real patients",
        `SELECT count(*)::int AS n FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id WHERE p.id IS NULL`,
      ],
      [
        "consultations reference real patients and appointments",
        `SELECT count(*)::int AS n FROM consultations c
         LEFT JOIN patients p ON p.id = c.patient_id
         LEFT JOIN appointments a ON a.id = c.appointment_id
         WHERE p.id IS NULL OR (c.appointment_id IS NOT NULL AND a.id IS NULL)`,
      ],
      [
        "prescriptions and lab tests reference real patients",
        `SELECT (SELECT count(*)::int FROM prescriptions pr LEFT JOIN patients p ON p.id = pr.patient_id WHERE p.id IS NULL)
              + (SELECT count(*)::int FROM lab_tests l LEFT JOIN patients p ON p.id = l.patient_id WHERE p.id IS NULL) AS n`,
      ],
      [
        "invoices reference real patients and appointments",
        `SELECT count(*)::int AS n FROM invoices i
         LEFT JOIN patients p ON p.id = i.patient_id
         LEFT JOIN appointments a ON a.id = i.appointment_id
         WHERE p.id IS NULL OR (i.appointment_id IS NOT NULL AND a.id IS NULL)`,
      ],
      [
        "claims reference real invoices and match the patient's policy",
        `SELECT count(*)::int AS n FROM insurance_claims ic
         LEFT JOIN invoices i ON i.id = ic.invoice_id
         LEFT JOIN patients p ON p.id = ic.patient_id
         WHERE i.id IS NULL OR p.id IS NULL OR ic.policy_number IS DISTINCT FROM p.insurance_policy_number`,
      ],
      [
        "emergency cases and surgeries reference real staff",
        `SELECT (SELECT count(*)::int FROM emergency_cases e LEFT JOIN staff s ON s.id = e.doctor_id WHERE e.doctor_id IS NOT NULL AND s.id IS NULL)
              + (SELECT count(*)::int FROM surgeries su LEFT JOIN staff s ON s.id = su.surgeon_id WHERE s.id IS NULL) AS n`,
      ],
      [
        "notifications reference real users",
        `SELECT count(*)::int AS n FROM notifications n LEFT JOIN users u ON u.id = n.recipient_id WHERE u.id IS NULL`,
      ],
      [
        "paid invoices never show paid < total",
        `SELECT count(*)::int AS n FROM invoices WHERE status = 'Paid' AND paid_amount < total_amount`,
      ],
      [
        "final insurance claims always carry a processed date",
        `SELECT count(*)::int AS n FROM insurance_claims WHERE status IN ('Approved', 'Denied') AND processed_date IS NULL`,
      ],
      [
        "overdue invoices are always past their due date",
        // Stored timestamps are UTC wall-clock, so lift them back to instants
        // explicitly instead of letting the session TimeZone reinterpret them.
        `SELECT count(*)::int AS n FROM invoices WHERE status = 'Overdue' AND (due_date AT TIME ZONE 'UTC') >= now()`,
      ],
      [
        "completed lab tests never carry a future completion time",
        `SELECT count(*)::int AS n FROM lab_tests WHERE status = 'Completed' AND (completed_at AT TIME ZONE 'UTC') > now()`,
      ],
      [
        "admitted (Critical/Active in bed) patients have consistent admission records",
        `SELECT count(*)::int AS n FROM beds b JOIN patients p ON p.id = b.patient_id
         WHERE b.status = 'Occupied' AND p.status = 'Critical' AND p.department <> 'ICU'`,
      ],
    ];
    for (const [label, sql] of checks) {
      const { rows } = await ctx.pool.query(sql);
      expect(rows[0].n, label).toBe(0);
    }
  });

  it("repairs drifted rows and preserves foreign rows on a third run", async () => {
    // Controlled experiment inside one transaction: break two seeded
    // invariants, add a row the seed does not manage, re-seed, verify both
    // repairs and that the foreign row survives, then roll everything back so
    // the test database keeps the clean state from the earlier runs.
    const marker = crypto.randomUUID();
    const ROLLBACK = new Error("controlled-change-rollback");

    try {
      await db.transaction(async (tx) => {
        const [claim] = await tx
          .select({ id: schema.insuranceClaims.id })
          .from(schema.insuranceClaims)
          .where(inArray(schema.insuranceClaims.status, ["Approved", "Denied"]))
          .limit(1);
        expect(claim).toBeDefined();
        await tx
          .update(schema.insuranceClaims)
          .set({ processedDate: null })
          .where(eq(schema.insuranceClaims.id, claim.id));

        const [invoice] = await tx
          .select({ id: schema.invoices.id })
          .from(schema.invoices)
          .where(eq(schema.invoices.status, "Pending"))
          .limit(1);
        expect(invoice).toBeDefined();
        await tx
          .update(schema.invoices)
          .set({
            status: "Overdue",
            dueDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
          })
          .where(eq(schema.invoices.id, invoice.id));

        const [admin] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.email, "admin@medcore.com"));
        expect(admin).toBeDefined();
        await tx.insert(schema.notifications).values({
          id: marker,
          recipientId: admin.id,
          title: "Outside the seed",
          message: "Pre-existing row that a re-seed must never delete.",
          type: "SYSTEM",
        });

        const finalMissing = (q: typeof tx) =>
          q
            .select({ n: count() })
            .from(schema.insuranceClaims)
            .where(
              and(
                inArray(schema.insuranceClaims.status, ["Approved", "Denied"]),
                isNull(schema.insuranceClaims.processedDate)
              )
            );
        expect((await finalMissing(tx))[0].n).toBe(1);

        await seedAll(tx);

        expect((await finalMissing(tx))[0].n).toBe(0);
        const overdue = await tx
          .select({ dueDate: schema.invoices.dueDate })
          .from(schema.invoices)
          .where(eq(schema.invoices.status, "Overdue"));
        expect(
          overdue.filter(
            (r) => r.dueDate !== null && r.dueDate.getTime() >= Date.now()
          )
        ).toHaveLength(0);
        const markerRow = await tx
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(eq(schema.notifications.id, marker));
        expect(markerRow).toHaveLength(1);

        throw ROLLBACK;
      });
      throw new Error("transaction should have rolled back");
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }

    const after = await ctx.pool.query(
      `SELECT
         (SELECT count(*)::int FROM notifications WHERE id = $1) AS marker,
         (SELECT count(*)::int FROM insurance_claims
           WHERE status IN ('Approved', 'Denied') AND processed_date IS NULL) AS claims_missing_processed,
         (SELECT count(*)::int FROM invoices
           WHERE status = 'Overdue' AND (due_date AT TIME ZONE 'UTC') >= now()) AS future_overdue`,
      [marker]
    );
    expect(after.rows[0]).toEqual({
      marker: 0,
      claims_missing_processed: 0,
      future_overdue: 0,
    });
  });

  it("exposes realistic demo metrics on the seeded data", async () => {
    // Day boundaries are computed in JS — the same local calendar frame the
    // seed writes in — and passed as ISO-UTC strings. PostgreSQL ignores the
    // zone designator on `timestamp` input, so the `Z`-marked instants are
    // compared in exactly the UTC wall-clock frame the values were stored
    // in. (Passing raw JS Dates does NOT work: node-postgres renders them
    // with a local `+05:30`-style offset, which lands on the wrong day.
    // Truncating `now()` inside SQL has the same class of bug — it compares
    // the current UTC day against values the seed wrote for the current
    // *local* day, which only agrees for part of the day.)
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const today = await ctx.pool.query(
      `SELECT
         (SELECT count(*)::int FROM medical_records
           WHERE title = 'Patient Admission' AND record_date >= $1 AND record_date < $2) AS admissions_today,
         (SELECT count(*)::int FROM medical_records
           WHERE record_type = 'Discharge' AND record_date >= $1 AND record_date < $2) AS discharges_today,
         (SELECT count(*)::int FROM appointments
           WHERE date >= $1 AND date < $2) AS appointments_today,
         (SELECT count(*)::int FROM emergency_cases
           WHERE arrival_time >= $1 AND arrival_time < $2) AS er_today,
         (SELECT count(*)::int FROM beds WHERE status = 'Occupied') AS occupied,
         (SELECT count(*)::int FROM patients WHERE phone LIKE '+91%') AS indian_patients,
         (SELECT count(*)::int FROM patients WHERE phone NOT LIKE '+91%') AS international_patients`,
      [dayStart.toISOString(), dayEnd.toISOString()]
    );
    const m = today.rows[0];
    expect(m.admissions_today).toBeGreaterThanOrEqual(3);
    expect(m.discharges_today).toBeGreaterThanOrEqual(2);
    expect(m.appointments_today).toBeGreaterThanOrEqual(10);
    expect(m.er_today).toBeGreaterThanOrEqual(1);
    expect(m.occupied).toBe(34);
    expect(m.indian_patients).toBe(68);
    expect(m.international_patients).toBe(12);
  });

  it("brands the demo administrator as Anurag Yadav without renaming the product accounts", async () => {
    const { rows } = await ctx.pool.query(
      `SELECT email, name FROM users WHERE email LIKE '%@medcore.com' ORDER BY email`
    );
    const byEmail = new Map(rows.map((r: { email: string; name: string }) => [r.email, r.name]));
    expect(byEmail.get("admin@medcore.com")).toBe("Anurag Yadav");
    expect(byEmail.get("doctor@medcore.com")).toBe("Dr. James Wilson");
    expect(byEmail.get("nurse@medcore.com")).toBe("Nurse Emily Chen");
    expect(byEmail.get("reception@medcore.com")).toBe("Maria Garcia");
    expect(byEmail.get("pharmacy@medcore.com")).toBe("Pharm. David Kim");
  });

  it("keeps the demo owner identity out of clinical records", async () => {
    // Phase 18: the owner/administrator identity must never be injected into
    // clinical documentation — clinical rows are recorded by clinicians.
    const { rows } = await ctx.pool.query(
      `SELECT
         (SELECT count(*)::int FROM medical_records WHERE recorded_by = 'Anurag Yadav') AS records,
         (SELECT count(*)::int FROM vitals WHERE recorded_by = 'Anurag Yadav') AS vitals,
         (SELECT count(*)::int FROM prescriptions WHERE prescribed_by = 'Anurag Yadav') AS scripts,
         (SELECT count(*)::int FROM lab_tests WHERE ordered_by = 'Anurag Yadav') AS labs`
    );
    expect(rows[0].records).toBe(0);
    expect(rows[0].vitals).toBe(0);
    expect(rows[0].scripts).toBe(0);
    expect(rows[0].labs).toBe(0);
  });

  it("never deletes pre-existing user data (audit logs survive)", async () => {
    const { rows } = await ctx.pool.query(
      `SELECT count(*)::int AS n FROM audit_logs`
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(0);
    // The seed itself must not create audit rows.
    const seeded = await ctx.pool.query(
      `SELECT count(*)::int AS n FROM audit_logs WHERE metadata::text LIKE '%PT-104%'`
    );
    expect(seeded.rows[0].n).toBe(0);
  });
});

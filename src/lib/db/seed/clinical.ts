import {
  consultations,
  labTests,
  medicalRecords,
  patientAllergies,
  patientConditions,
  patientMedications,
  prescriptions,
  vitals,
} from "@/lib/db/schema";
import {
  ALLERGY_SEEDS,
  CHIEF_COMPLAINTS,
  CLINICAL_NOTE_TITLES,
  CONDITION_SEEDS,
  CURRENT_MEDICATION_SEEDS,
  DIAGNOSES,
  DISCHARGE_INSTRUCTIONS,
  LAB_CATALOG,
  LAB_RESULTS,
  MEDICINES,
  STAFF_SEED,
  TREATMENT_PLANS,
} from "./datasets";
import { createRng, deterministicUuid, pick, type Rng } from "./ids";
import {
  daysFrom,
  hoursFrom,
  type PatientPlan,
  type SeedContext,
  type SeedCounts,
  type Tx,
} from "./types";

const pad3 = (n: number): string => String(n).padStart(3, "0");

const ADMISSION_REASONS = [
  "Elective admission for investigation and management.",
  "Admitted via emergency department for observation.",
  "Planned admission for procedure and pre-op workup.",
  "Day-care admission for IV therapy and monitoring.",
];

const NURSE_NAMES = STAFF_SEED.filter((s) => s.role === "Nurse").map(
  (s) => `${s.firstName} ${s.lastName}`
);

/** Never return a "today" timestamp in the future (keeps dashboards sane). */
function clampToNow(date: Date, now: Date): Date {
  return date > now ? now : date;
}

export async function seedClinical(
  tx: Tx,
  ctx: SeedContext
): Promise<SeedCounts> {
  const rng = createRng(0x0c11c1a1);
  const now = ctx.now;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plans = ctx.plans;
  const counts: SeedCounts = {};

  // --- Consultations (70, one per distinct patient for 70 of the 80) -----
  const consultationIdsByPatient = new Map<string, string[]>();
  const totalConsultations = 70;
  for (let i = 0; i < totalConsultations; i++) {
    const plan = plans[(i * 13) % plans.length];
    const patientKey = plan.patientId;
    const patientAppointments = ctx.appointmentsByPatient.get(patientKey) ?? [];
    const completed = patientAppointments.filter((a) => a.status === "Completed");
    const linked =
      completed.length > 0 ? completed[i % completed.length] : undefined;
    const consultationKey = `${patientKey}#${i}`;
    const createdAt = daysFrom(now, -(1 + Math.floor(rng() * 44)));
    const rows = await tx
      .insert(consultations)
      .values({
        id: deterministicUuid("consultation", consultationKey),
        patientId: ctx.patients.get(patientKey)!,
        appointmentId: linked ? linked.id : null,
        doctorName: plan.attendingDoctor,
        chiefComplaint: pick(rng, CHIEF_COMPLAINTS),
        diagnosis: pick(rng, DIAGNOSES),
        treatmentPlan: pick(rng, TREATMENT_PLANS),
        notes: i % 3 === 0 ? "Reviewed previous records and current medications." : null,
        followUpDate: i % 4 === 0 ? daysFrom(createdAt, 14) : null,
        createdAt,
        updatedAt: createdAt,
      })
      .onConflictDoUpdate({
        target: consultations.id,
        set: {
          patientId: ctx.patients.get(patientKey)!,
          appointmentId: linked ? linked.id : null,
          doctorName: plan.attendingDoctor,
          chiefComplaint: pick(rng, CHIEF_COMPLAINTS),
          diagnosis: pick(rng, DIAGNOSES),
          treatmentPlan: pick(rng, TREATMENT_PLANS),
          updatedAt: new Date(),
        },
      })
      .returning({ id: consultations.id });
    ctx.consultations.set(consultationKey, rows[0].id);
    const list = consultationIdsByPatient.get(patientKey) ?? [];
    list.push(rows[0].id);
    consultationIdsByPatient.set(patientKey, list);
  }
  counts.consultations = totalConsultations;

  // --- Prescriptions (210, always named after a real pharmacy medicine) ---
  const totalPrescriptions = 210;
  const frequencyOptions = [
    "Once daily",
    "Twice daily",
    "Every 8 hours",
    "At bedtime",
    "Before meals",
    "As needed",
  ];
  const durationOptions = ["5 days", "7 days", "10 days", "14 days", "30 days"];
  for (let i = 0; i < totalPrescriptions; i++) {
    const plan = plans[i % plans.length];
    const medicine = MEDICINES[i % MEDICINES.length];
    const startDaysAgo = 1 + Math.floor(rng() * 70);
    const startDate = daysFrom(now, -startDaysAgo);
    const bucket = rng();
    const status = bucket < 0.7 ? "Active" : bucket < 0.9 ? "Completed" : "Discontinued";
    const duration = pick(rng, durationOptions);
    const patientConsults = consultationIdsByPatient.get(plan.patientId) ?? [];
    const consultationId =
      patientConsults.length > 0 && i % 3 !== 0
        ? patientConsults[i % patientConsults.length]
        : null;
    await tx
      .insert(prescriptions)
      .values({
        id: deterministicUuid("prescription", `${plan.patientId}:${i}`),
        patientId: ctx.patients.get(plan.patientId)!,
        consultationId,
        medicationName: medicine.name,
        dosage: medicine.dosage === "—" ? "As directed" : medicine.dosage,
        frequency: pick(rng, frequencyOptions),
        duration,
        instructions:
          i % 5 === 0 ? "Take after food. Complete the full course." : null,
        prescribedBy: plan.attendingDoctor,
        startDate,
        endDate: status === "Active" ? null : daysFrom(startDate, 7),
        status,
        createdAt: startDate,
        updatedAt: startDate,
      })
      .onConflictDoUpdate({
        target: prescriptions.id,
        set: {
          patientId: ctx.patients.get(plan.patientId)!,
          consultationId,
          medicationName: medicine.name,
          dosage: medicine.dosage === "—" ? "As directed" : medicine.dosage,
          frequency: pick(rng, frequencyOptions),
          duration,
          instructions:
            i % 5 === 0 ? "Take after food. Complete the full course." : null,
          prescribedBy: plan.attendingDoctor,
          startDate,
          endDate: status === "Active" ? null : daysFrom(startDate, 7),
          status,
          updatedAt: new Date(),
        },
      });
  }
  counts.prescriptions = totalPrescriptions;

  // --- Patient allergies / conditions / current medications --------------
  let allergyCount = 0;
  let conditionCount = 0;
  let medicationCount = 0;
  for (const plan of plans) {
    const patientRowId = ctx.patients.get(plan.patientId)!;
    if (rng() < 0.45) {
      const chosen = sampleWithoutReplacement(rng, ALLERGY_SEEDS, rng() < 0.3 ? 2 : 1);
      for (const entry of chosen) {
        await tx
          .insert(patientAllergies)
          .values({
            id: deterministicUuid(patientRowId, `allergy:${entry.allergy}`),
            patientId: patientRowId,
            allergy: entry.allergy,
            severity: entry.severity,
            createdAt: daysFrom(now, -200),
          })
          .onConflictDoUpdate({
            target: patientAllergies.id,
            set: {
              patientId: patientRowId,
              allergy: entry.allergy,
              severity: entry.severity,
            },
          });
        allergyCount += 1;
      }
    }
    if (rng() < 0.6) {
      const chosen = sampleWithoutReplacement(rng, CONDITION_SEEDS, rng() < 0.35 ? 2 : 1);
      for (const entry of chosen) {
        await tx
          .insert(patientConditions)
          .values({
            id: deterministicUuid(patientRowId, `condition:${entry.condition}`),
            patientId: patientRowId,
            condition: entry.condition,
            diagnosedDate: daysFrom(now, -30 - Math.floor(rng() * 1400)),
            status: entry.status,
            createdAt: daysFrom(now, -200),
          })
          .onConflictDoUpdate({
            target: patientConditions.id,
            set: {
              patientId: patientRowId,
              condition: entry.condition,
              status: entry.status,
            },
          });
        conditionCount += 1;
      }
    }
    if (rng() < 0.45) {
      const chosen = sampleWithoutReplacement(rng, CURRENT_MEDICATION_SEEDS, rng() < 0.3 ? 2 : 1);
      for (const entry of chosen) {
        const start = daysFrom(now, -20 - Math.floor(rng() * 500));
        await tx
          .insert(patientMedications)
          .values({
            id: deterministicUuid(patientRowId, `med:${entry.medication}`),
            patientId: patientRowId,
            medication: entry.medication,
            dosage: entry.dosage,
            frequency: entry.frequency,
            prescribedBy: plan.attendingDoctor,
            startDate: start,
            endDate: null,
            createdAt: start,
          })
          .onConflictDoUpdate({
            target: patientMedications.id,
            set: {
              patientId: patientRowId,
              medication: entry.medication,
              dosage: entry.dosage,
              frequency: entry.frequency,
              prescribedBy: plan.attendingDoctor,
              startDate: start,
              endDate: null,
            },
          });
        medicationCount += 1;
      }
    }
  }
  counts.patientAllergies = allergyCount;
  counts.patientConditions = conditionCount;
  counts.patientMedications = medicationCount;

  // --- Medical records: admissions, discharges, clinical notes -----------
  let recordCount = 0;
  const recordSeq = new Map<string, number>();
  const nextRecordId = (patientRowId: string): string => {
    const n = (recordSeq.get(patientRowId) ?? 0) + 1;
    recordSeq.set(patientRowId, n);
    return deterministicUuid(patientRowId, `mr:${n}`);
  };

  const admittedPlans = plans.filter((p) => p.admitted && !p.discharged);
  const dischargedPlans = plans.filter((p) => p.discharged);

  const insertRecord = async (values: {
    patientRowId: string;
    recordType: string;
    title: string;
    description: string | null;
    recordedBy: string;
    recordDate: Date;
  }): Promise<void> => {
    await tx
      .insert(medicalRecords)
      .values({
        id: nextRecordId(values.patientRowId),
        patientId: values.patientRowId,
        recordType: values.recordType,
        title: values.title,
        description: values.description,
        fileUrl: null,
        recordedBy: values.recordedBy,
        recordDate: values.recordDate,
        createdAt: values.recordDate,
      })
      .onConflictDoUpdate({
        target: medicalRecords.id,
        set: {
          patientId: values.patientRowId,
          recordType: values.recordType,
          title: values.title,
          description: values.description,
          recordedBy: values.recordedBy,
          recordDate: values.recordDate,
        },
      });
    recordCount += 1;
  };

  // Admission records: 3 today, 6 across the last week, rest older.
  for (let i = 0; i < admittedPlans.length; i++) {
    const plan = admittedPlans[i];
    const patientRowId = ctx.patients.get(plan.patientId)!;
    let admissionDate: Date;
    if (i < 3) {
      admissionDate = clampToNow(hoursFrom(today, 9 + i * 2), now);
    } else if (i < 9) {
      admissionDate = daysFrom(today, -(i - 2)); // -1 .. -6
    } else {
      admissionDate = daysFrom(now, -7 - Math.floor(rng() * 38));
    }
    await insertRecord({
      patientRowId,
      recordType: "Administrative",
      title: "Patient Admission",
      description: `${pick(rng, ADMISSION_REASONS)}\n\nNotes: Admitted under ${plan.department} under the care of ${plan.attendingDoctor}.`,
      // Owner identity must never appear in clinical records — admissions
      // are recorded by the attending clinician (Phase 18).
      recordedBy: plan.attendingDoctor,
      recordDate: admissionDate,
    });
  }

  // Discharge records: 2 today, 2 this week, rest older (admission precedes discharge).
  for (let i = 0; i < dischargedPlans.length; i++) {
    const plan = dischargedPlans[i];
    const patientRowId = ctx.patients.get(plan.patientId)!;
    let dischargeDate: Date;
    if (i < 2) {
      dischargeDate = clampToNow(hoursFrom(today, 10 + i * 3), now);
    } else if (i < 4) {
      dischargeDate = daysFrom(today, -(i - 1)); // -1, -2
    } else {
      dischargeDate = daysFrom(now, -8 - Math.floor(rng() * 32));
    }
    const admissionDate = daysFrom(
      dischargeDate,
      -(2 + Math.floor(rng() * 5))
    );
    await insertRecord({
      patientRowId,
      recordType: "Administrative",
      title: "Patient Admission",
      description: `${pick(rng, ADMISSION_REASONS)}\n\nNotes: Admitted under ${plan.department}.`,
      // Owner identity must never appear in clinical records (Phase 18).
      recordedBy: plan.attendingDoctor,
      recordDate: admissionDate,
    });
    await insertRecord({
      patientRowId,
      recordType: "Discharge",
      title: "Discharge Summary",
      description: JSON.stringify({
        diagnosis: pick(rng, DIAGNOSES),
        treatmentSummary: pick(rng, TREATMENT_PLANS),
        followUpInstructions: pick(rng, DISCHARGE_INSTRUCTIONS),
        medicationsOnDischarge: pick(rng, MEDICINES).name,
        followUpDate: daysFrom(dischargeDate, 7).toISOString(),
        notes: "Discharge processed through the MedCore workflow (demo data).",
      }),
      recordedBy: plan.attendingDoctor,
      recordDate: dischargeDate,
    });
  }

  // Clinical / lab / imaging notes for everyone (some landing today).
  const totalNotes = 150;
  for (let i = 0; i < totalNotes; i++) {
    const plan = plans[i % plans.length];
    const patientRowId = ctx.patients.get(plan.patientId)!;
    const kind = i % 10;
    const recordType = kind < 7 ? "Clinical" : kind < 9 ? "Lab" : "Imaging";
    const title =
      recordType === "Clinical"
        ? pick(rng, CLINICAL_NOTE_TITLES)
        : recordType === "Lab"
          ? `Lab report — ${pick(rng, LAB_CATALOG).testName}`
          : pick(rng, ["Chest X-Ray report", "USG abdomen report", "ECG report"]);
    const recordDate =
      i < 5
        ? clampToNow(hoursFrom(today, 8 + i), now)
        : daysFrom(now, -1 - Math.floor(rng() * 44));
    await insertRecord({
      patientRowId,
      recordType,
      title,
      description: `${title} for ${plan.firstName} ${plan.lastName}. ${pick(rng, TREATMENT_PLANS)}`,
      recordedBy:
        recordType === "Clinical" ? plan.attendingDoctor : pick(rng, NURSE_NAMES),
      recordDate,
    });
  }
  counts.medicalRecords = recordCount;

  // --- Vitals (160 readings) ---------------------------------------------
  let vitalsCount = 0;
  const vitalsFor: { plan: PatientPlan; readings: number }[] = [
    ...plans.filter((p) => p.admitted && !p.discharged).map((p) => ({ plan: p, readings: 3 })),
    ...plans.filter((p) => p.discharged).map((p) => ({ plan: p, readings: 1 })),
    ...plans.filter((p) => !p.admitted).map((p) => ({ plan: p, readings: 1 })),
  ];
  let readingIndex = 0;
  for (const entry of vitalsFor) {
    const patientRowId = ctx.patients.get(entry.plan.patientId)!;
    for (let r = 0; r < entry.readings; r++) {
      readingIndex += 1;
      const recordedAt = r === 0 && readingIndex % 9 === 0
        ? clampToNow(hoursFrom(today, 7 + (readingIndex % 8)), now)
        : daysFrom(now, -(r * 2 + Math.floor(rng() * 12)));
      const systolic = 96 + Math.floor(rng() * 62);
      const diastolic = 58 + Math.floor(rng() * 38);
      const age = ageOf(entry.plan, now);
      const child = age < 15;
      await tx
        .insert(vitals)
        .values({
          id: deterministicUuid(patientRowId, `vitals:${r}`),
          patientId: patientRowId,
          bloodPressureSystolic: Math.max(systolic, diastolic + 22),
          bloodPressureDiastolic: diastolic,
          heartRate: 58 + Math.floor(rng() * 60),
          temperature: Math.round((97.4 + rng() * 4.2) * 10) / 10,
          respiratoryRate: 14 + Math.floor(rng() * 11),
          oxygenSaturation: 90 + Math.floor(rng() * 11),
          weight:
            Math.round((child ? 12 + rng() * 32 : 46 + rng() * 46) * 10) / 10,
          height:
            Math.round((child ? 92 + rng() * 68 : 148 + rng() * 36) * 10) / 10,
          recordedBy: pick(rng, NURSE_NAMES),
          recordedAt,
          createdAt: recordedAt,
        })
        .onConflictDoUpdate({
          target: vitals.id,
          set: {
            patientId: patientRowId,
            bloodPressureSystolic: Math.max(systolic, diastolic + 22),
            bloodPressureDiastolic: diastolic,
            recordedBy: pick(rng, NURSE_NAMES),
            recordedAt,
          },
        });
      vitalsCount += 1;
    }
  }
  counts.vitals = vitalsCount;

  // --- Laboratory tests (130) ---------------------------------------------
  let labCount = 0;
  const totalLabs = 130;
  for (let i = 0; i < totalLabs; i++) {
    const testId = `LAB-${pad3(i + 1)}`;
    const plan = plans[(i * 11) % plans.length];
    const entry = LAB_CATALOG[i % LAB_CATALOG.length];
    const bucket = rng();
    const status = bucket < 0.6 ? "Completed" : bucket < 0.8 ? "In Progress" : "Pending";
    const testDate = daysFrom(now, -Math.floor(rng() * 30));
    const patientConsults = consultationIdsByPatient.get(plan.patientId) ?? [];
    const consultationId =
      patientConsults.length > 0 && i % 4 !== 0
        ? patientConsults[i % patientConsults.length]
        : null;
    await tx
      .insert(labTests)
      .values({
        id: deterministicUuid("lab", testId),
        testId,
        patientId: ctx.patients.get(plan.patientId)!,
        consultationId,
        testName: entry.testName,
        category: entry.category,
        orderedBy: plan.attendingDoctor,
        status,
        result: status === "Completed" ? pick(rng, LAB_RESULTS) : null,
        notes:
          status === "Completed" ? null : "Sample collected / awaiting processing.",
        testDate,
        completedAt:
          status === "Completed" ? clampToNow(hoursFrom(testDate, 6), now) : null,
        createdAt: testDate,
        updatedAt: testDate,
      })
      .onConflictDoUpdate({
        target: labTests.testId,
        set: {
          patientId: ctx.patients.get(plan.patientId)!,
          consultationId,
          testName: entry.testName,
          category: entry.category,
          orderedBy: plan.attendingDoctor,
          status,
          result: status === "Completed" ? pick(rng, LAB_RESULTS) : null,
          testDate,
          completedAt:
            status === "Completed" ? clampToNow(hoursFrom(testDate, 6), now) : null,
          updatedAt: new Date(),
        },
      });
    labCount += 1;
  }
  counts.labTests = labCount;

  return counts;
}

function ageOf(plan: PatientPlan, now: Date): number {
  return Math.floor(
    (now.getTime() - plan.dateOfBirth.getTime()) /
      (365.25 * 24 * 3600 * 1000)
  );
}

function sampleWithoutReplacement<T>(
  rng: Rng,
  items: readonly T[],
  count: number
): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

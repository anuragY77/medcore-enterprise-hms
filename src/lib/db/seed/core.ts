import {
  beds,
  departments,
  patients,
  staff,
  users,
} from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "@/lib/password";
import {
  BLOOD_GROUPS,
  CLINICAL_DEPARTMENTS,
  CITIES,
  DEMO_PASSWORD,
  DEMO_USERS,
  DEPARTMENTS,
  INDIA_ADMIT_DEPARTMENTS,
  INDIAN_FEMALE_FIRST,
  INDIAN_LAST,
  INDIAN_MALE_FIRST,
  INTERNATIONAL_PATIENTS,
  STAFF_SEED,
  STREETS,
  INSURANCE_PROVIDERS,
} from "./datasets";
import { createRng, deterministicUuid, pick, type Rng } from "./ids";
import {
  daysFrom,
  type PatientPlan,
  type SeedContext,
  type SeedCounts,
  type Tx,
} from "./types";

const pad3 = (n: number): string => String(n).padStart(3, "0");

/** Random-but-repeatable Indian phone number. */
function indianPhone(rng: Rng): string {
  const head = pick(rng, ["98", "99", "97", "96", "95", "70", "88"]);
  let rest = "";
  for (let i = 0; i < 8; i++) rest += Math.floor(rng() * 10);
  return `+91 ${head}${rest.slice(0, 3)} ${rest.slice(3)}`;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function ageToDob(rng: Rng, now: Date): Date {
  const bucket = rng();
  const age =
    bucket < 0.15
      ? 1 + Math.floor(rng() * 14)
      : bucket < 0.65
        ? 25 + Math.floor(rng() * 30)
        : 56 + Math.floor(rng() * 26);
  return new Date(
    now.getFullYear() - age,
    Math.floor(rng() * 12),
    1 + Math.floor(rng() * 28)
  );
}

export interface PatientBuildExtras {
  phone: string;
  city: string;
  bloodGroup: string | null;
  email: string | null;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export type PatientBuild = PatientPlan & PatientBuildExtras;

/**
 * Build the 80-patient demo roster: 68 Indian patients + 12 international,
 * split into ICU-critical (6), ward-admitted (28), discharged (14) and
 * outpatients (32). Pure and rng-driven so tests can validate the shape
 * without a database.
 */
export function buildPatientPlans(rng: Rng, now: Date): PatientBuild[] {
  type Person = {
    firstName: string;
    lastName: string;
    gender: "Male" | "Female";
    phone: string;
    city: string;
  };

  const people: Person[] = [];
  for (let i = 0; i < 34; i++) {
    people.push({
      firstName: INDIAN_MALE_FIRST[i % INDIAN_MALE_FIRST.length],
      lastName: INDIAN_LAST[Math.floor(rng() * INDIAN_LAST.length)],
      gender: "Male",
      phone: indianPhone(rng),
      city: pick(rng, CITIES),
    });
  }
  for (let i = 0; i < 34; i++) {
    people.push({
      firstName: INDIAN_FEMALE_FIRST[i % INDIAN_FEMALE_FIRST.length],
      lastName: INDIAN_LAST[Math.floor(rng() * INDIAN_LAST.length)],
      gender: "Female",
      phone: indianPhone(rng),
      city: pick(rng, CITIES),
    });
  }
  for (const p of INTERNATIONAL_PATIENTS) {
    people.push({
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      phone: p.phone,
      city: p.city,
    });
  }

  // Role assignment: 6 critical (ICU), 28 ward-admitted, 14 discharged,
  // 32 outpatients — shuffled so demographics stay independent of role.
  const roles: PatientPlan["status"][] = [];
  const admittedFlag: boolean[] = [];
  const dischargedFlag: boolean[] = [];
  for (let i = 0; i < 6; i++) { roles.push("Critical"); admittedFlag.push(true); dischargedFlag.push(false); }
  for (let i = 0; i < 28; i++) { roles.push("Active"); admittedFlag.push(true); dischargedFlag.push(false); }
  for (let i = 0; i < 14; i++) { roles.push("Discharged"); admittedFlag.push(true); dischargedFlag.push(true); }
  for (let i = 0; i < 32; i++) { roles.push("Active"); admittedFlag.push(false); dischargedFlag.push(false); }
  const order = roles.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const doctorsByDept = new Map<string, string[]>();
  for (const s of STAFF_SEED) {
    if (s.role !== "Doctor") continue;
    const display = `Dr. ${s.firstName} ${s.lastName}`;
    const list = doctorsByDept.get(s.department) ?? [];
    list.push(display);
    doctorsByDept.set(s.department, list);
  }
  const fallbackDoctors = doctorsByDept.get("General Medicine") ?? [];

  const opdDepartments = [
    "General Medicine",
    "General Medicine",
    "Cardiology",
    "Pediatrics",
    "Orthopedics",
    "Neurology",
    "Radiology",
    "Laboratory",
  ];

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const plans: PatientBuild[] = [];

  for (let i = 0; i < people.length; i++) {
    const person = people[order[i]];
    const roleIdx = order[i];
    const status = roles[roleIdx];
    const admitted = admittedFlag[roleIdx];
    const discharged = dischargedFlag[roleIdx];

    let department: string;
    if (status === "Critical") {
      department = "ICU";
    } else if (admitted && !discharged) {
      department = pick(rng, INDIA_ADMIT_DEPARTMENTS);
    } else if (discharged) {
      department = pick(rng, CLINICAL_DEPARTMENTS);
    } else {
      department = pick(rng, opdDepartments);
    }

    const deptDoctors = doctorsByDept.get(department);
    const attendingDoctor =
      deptDoctors && deptDoctors.length > 0
        ? deptDoctors[i % deptDoctors.length]
        : fallbackDoctors[i % Math.max(fallbackDoctors.length, 1)];

    const insured = rng() < 0.45;
    const patientKey = `PT-${10482 + i}`;
    const createdAt =
      i < 12
        ? new Date(monthStart.getTime() + i * 30 * 60 * 1000)
        : daysFrom(now, -(3 + Math.floor(rng() * 117)));

    plans.push({
      patientId: patientKey,
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender,
      department,
      attendingDoctor,
      status,
      admitted,
      discharged,
      insured,
      insuranceProvider: insured
        ? pick(rng, INSURANCE_PROVIDERS)
        : null,
      insurancePolicyNumber: insured
        ? `HLTH-${2021 + (i % 5)}-${10000 + i}`
        : null,
      createdAt,
      phone: person.phone,
      city: person.city,
      dateOfBirth: ageToDob(rng, now),
      bloodGroup: rng() < 0.8 ? pick(rng, BLOOD_GROUPS) : null,
      email:
        rng() < 0.6
          ? `${slug(person.firstName)}.${slug(person.lastName)}${i}@example.com`
          : null,
      address: `${1 + Math.floor(rng() * 200)}, ${pick(rng, STREETS)}, ${person.city}`,
      emergencyContactName: `${pick(rng, person.gender === "Male" ? INDIAN_FEMALE_FIRST : INDIAN_MALE_FIRST)} ${person.lastName}`,
      emergencyContactPhone: indianPhone(rng),
    });
  }

  return plans;
}

export interface BedRow {
  bedId: string;
  roomNumber: string;
  department: string;
  ward: string;
  type: string;
}

/** Build every demo bed (94 across the seven admitting departments). */
export function buildBedRows(): BedRow[] {
  const rows: BedRow[] = [];
  let seq = 0;
  DEPARTMENTS.forEach((dept, deptIdx) => {
    let roomSeq = 0;
    for (const [type, count] of Object.entries(dept.bedTypes)) {
      for (let k = 0; k < (count ?? 0); k++) {
        seq += 1;
        roomSeq += 1;
        const ward =
          type === "ICU"
            ? "ICU Bay"
            : type === "Private"
              ? "Private Rooms"
              : type === "Semi-Private"
                ? "Semi-Private Wing"
                : "General Ward";
        rows.push({
          bedId: `BED-${pad3(seq)}`,
          roomNumber: String((deptIdx + 1) * 100 + roomSeq),
          department: dept.name,
          ward,
          type,
        });
      }
    }
  });
  return rows;
}

export async function seedCore(
  tx: Tx,
  ctx: SeedContext
): Promise<SeedCounts> {
  const rng = createRng(0xc0ffee);
  const counts: SeedCounts = {};
  const now = ctx.now;

  // --- Departments -------------------------------------------------------
  const doctorsByDept = new Map<string, string>();
  for (const s of STAFF_SEED) {
    if (s.role === "Doctor" && !doctorsByDept.has(s.department)) {
      doctorsByDept.set(s.department, `Dr. ${s.firstName} ${s.lastName}`);
    }
  }
  let deptSeq = 0;
  for (const dept of DEPARTMENTS) {
    deptSeq += 1;
    const totalBeds = Object.values(dept.bedTypes).reduce(
      (sum, n) => sum + (n ?? 0),
      0
    );
    const inserted = await tx
      .insert(departments)
      .values({
        id: deterministicUuid("department", dept.name),
        departmentId: `DEPT-${pad3(deptSeq)}`,
        name: dept.name,
        description: dept.description,
        headDoctor: doctorsByDept.get(dept.name) ?? null,
        phone: `+91 22 4000 ${100 + deptSeq}`,
        location: dept.location,
        totalBeds,
        status: "Active",
        createdAt: daysFrom(now, -420),
        updatedAt: daysFrom(now, -420),
      })
      .onConflictDoUpdate({
        target: departments.name,
        set: {
          description: dept.description,
          headDoctor: doctorsByDept.get(dept.name) ?? null,
          phone: `+91 22 4000 ${100 + deptSeq}`,
          location: dept.location,
          totalBeds,
          status: "Active",
          updatedAt: new Date(),
        },
      })
      .returning({ id: departments.id });
    ctx.departments.set(dept.name, inserted[0].id);
  }
  counts.departments = deptSeq;

  // --- Demo users --------------------------------------------------------
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
  let userCount = 0;
  for (const user of DEMO_USERS) {
    const rows = await tx
      .insert(users)
      .values({
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        avatar: user.avatar,
        password: hashedPassword,
        createdAt: daysFrom(now, -365),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: user.name,
          role: user.role,
          department: user.department,
          avatar: user.avatar,
          password: hashedPassword,
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id });
    ctx.users.set(user.email, rows[0].id);
    userCount += 1;
  }
  counts.demoUsers = userCount;

  // --- Staff -------------------------------------------------------------
  let staffCount = 0;
  for (const member of STAFF_SEED) {
    const joined = daysFrom(now, -member.joinedDaysAgo);
    const rows = await tx
      .insert(staff)
      .values({
        id: deterministicUuid("staff", member.staffId),
        staffId: member.staffId,
        firstName: member.firstName,
        lastName: member.lastName,
        email: `${slug(member.firstName)}.${slug(member.lastName)}@medcore.com`,
        phone: member.phone,
        role: member.role,
        department: member.department,
        specialization: member.specialization,
        qualification: member.qualification,
        experience: member.experience,
        status: "Active",
        joiningDate: joined,
        createdAt: joined,
        updatedAt: joined,
      })
      .onConflictDoUpdate({
        target: staff.staffId,
        set: {
          firstName: member.firstName,
          lastName: member.lastName,
          email: `${slug(member.firstName)}.${slug(member.lastName)}@medcore.com`,
          phone: member.phone,
          role: member.role,
          department: member.department,
          specialization: member.specialization,
          qualification: member.qualification,
          experience: member.experience,
          status: "Active",
          joiningDate: joined,
          updatedAt: new Date(),
        },
      })
      .returning({ id: staff.id });
    ctx.staff.set(member.staffId, rows[0].id);
    if (member.role === "Doctor") {
      ctx.doctors.push({
        staffId: member.staffId,
        name: `Dr. ${member.firstName} ${member.lastName}`,
        department: member.department,
      });
    }
    staffCount += 1;
  }
  counts.staff = staffCount;

  // --- Patients ----------------------------------------------------------
  const plans = buildPatientPlans(rng, now);
  ctx.plans = plans;
  let patientCount = 0;
  for (const plan of plans) {
    const rows = await tx
      .insert(patients)
      .values({
        id: deterministicUuid("patient", plan.patientId),
        patientId: plan.patientId,
        firstName: plan.firstName,
        lastName: plan.lastName,
        dateOfBirth: plan.dateOfBirth,
        gender: plan.gender,
        bloodGroup: plan.bloodGroup,
        phone: plan.phone,
        email: plan.email,
        address: plan.address,
        department: plan.department,
        attendingDoctor: plan.attendingDoctor,
        status: plan.status,
        insuranceProvider: plan.insuranceProvider,
        insurancePolicyNumber: plan.insurancePolicyNumber,
        emergencyContactName: plan.emergencyContactName,
        emergencyContactPhone: plan.emergencyContactPhone,
        createdAt: plan.createdAt,
        updatedAt: plan.createdAt,
      })
      .onConflictDoUpdate({
        target: patients.patientId,
        set: {
          firstName: plan.firstName,
          lastName: plan.lastName,
          dateOfBirth: plan.dateOfBirth,
          gender: plan.gender,
          bloodGroup: plan.bloodGroup,
          phone: plan.phone,
          email: plan.email,
          address: plan.address,
          department: plan.department,
          attendingDoctor: plan.attendingDoctor,
          status: plan.status,
          insuranceProvider: plan.insuranceProvider,
          insurancePolicyNumber: plan.insurancePolicyNumber,
          emergencyContactName: plan.emergencyContactName,
          emergencyContactPhone: plan.emergencyContactPhone,
          updatedAt: new Date(),
        },
      })
      .returning({ id: patients.id });
    ctx.patients.set(plan.patientId, rows[0].id);
    patientCount += 1;
  }
  counts.patients = patientCount;

  // --- Beds --------------------------------------------------------------
  const bedRows = buildBedRows();
  const bedsByDept = new Map<string, BedRow[]>();
  for (const bed of bedRows) {
    const list = bedsByDept.get(bed.department) ?? [];
    list.push(bed);
    bedsByDept.set(bed.department, list);
  }

  // Assign every currently admitted patient to a bed (ICU-critical first).
  const bedAssignment = new Map<string, string>(); // bedId -> patientId
  const freeByDept = new Map<string, BedRow[]>(
    [...bedsByDept.entries()].map(([k, v]) => [k, [...v]])
  );
  const takeBed = (dept: string): BedRow | undefined => {
    const list = freeByDept.get(dept);
    if (list && list.length > 0) return list.shift();
    for (const other of freeByDept.values()) {
      if (other.length > 0) return other.shift();
    }
    return undefined;
  };
  const criticalPlans = plans.filter((p) => p.status === "Critical");
  const wardPlans = plans.filter(
    (p) => p.admitted && !p.discharged && p.status !== "Critical"
  );
  for (const plan of criticalPlans) {
    const bed = takeBed("ICU") ?? takeBed(plan.department);
    if (bed) bedAssignment.set(bed.bedId, plan.patientId);
  }
  for (const plan of wardPlans) {
    const bed = takeBed(plan.department);
    if (bed) bedAssignment.set(bed.bedId, plan.patientId);
  }

  // A few beds deliberately out of service for a realistic mix.
  const maintenanceBeds = ["General Medicine", "Orthopedics", "Pediatrics"]
    .flatMap((d) => freeByDept.get(d) ?? [])
    .slice(0, 3);
  const reservedBeds = ["Cardiology", "Neurology"]
    .flatMap((d) => freeByDept.get(d) ?? [])
    .slice(0, 2);
  const maintenanceSet = new Set(maintenanceBeds.map((b) => b.bedId));
  const reservedSet = new Set(reservedBeds.map((b) => b.bedId));

  let bedCount = 0;
  for (const bed of bedRows) {
    const assignedPatient = bedAssignment.get(bed.bedId);
    const status = assignedPatient
      ? "Occupied"
      : maintenanceSet.has(bed.bedId)
        ? "Maintenance"
        : reservedSet.has(bed.bedId)
          ? "Reserved"
          : "Available";
    await tx
      .insert(beds)
      .values({
        id: deterministicUuid("bed", bed.bedId),
        bedId: bed.bedId,
        roomNumber: bed.roomNumber,
        department: bed.department,
        ward: bed.ward,
        type: bed.type,
        status,
        patientId: assignedPatient
          ? ctx.patients.get(assignedPatient)
          : null,
        createdAt: daysFrom(now, -400),
        updatedAt: daysFrom(now, -1),
      })
      .onConflictDoUpdate({
        target: beds.bedId,
        set: {
          roomNumber: bed.roomNumber,
          department: bed.department,
          ward: bed.ward,
          type: bed.type,
          status,
          patientId: assignedPatient ? ctx.patients.get(assignedPatient) : null,
          updatedAt: new Date(),
        },
      });
    bedCount += 1;
  }
  counts.beds = bedCount;

  return counts;
}

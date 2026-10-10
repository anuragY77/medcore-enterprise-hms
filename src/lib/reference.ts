import { and, eq, inArray } from "drizzle-orm";
import { db, departments, staff } from "@/lib/db";

// Phase 28 (reference data): patient registration hard-coded its department
// and attending-doctor dropdowns, so the form offered values that do not exist
// in this hospital (5 of 10 hard-coded departments are absent from the
// departments table) and silently wrote them into patients. This module is
// the single authoritative source: active departments for the selects, active
// clinical staff rendered in the same `Dr. First Last` convention the seed
// uses for patients.attending_doctor.
//
// Staff is queried by its display role values ("Doctor"/"Surgeon") — the
// staff.role column stores those, not the auth enum constants.

export interface ReferenceOptions {
  departments: string[];
  doctors: string[];
}

export async function loadReferenceOptions(): Promise<ReferenceOptions> {
  const [departmentRows, staffRows] = await Promise.all([
    db
      .select({ name: departments.name })
      .from(departments)
      .where(eq(departments.status, "Active"))
      .orderBy(departments.name),
    db
      .select({ firstName: staff.firstName, lastName: staff.lastName })
      .from(staff)
      .where(
        and(
          eq(staff.status, "Active"),
          inArray(staff.role, ["Doctor", "Surgeon"])
        )
      )
      .orderBy(staff.lastName),
  ]);

  return {
    departments: departmentRows.map((row) => row.name),
    doctors: staffRows.map((row) => `Dr. ${row.firstName} ${row.lastName}`),
  };
}

export interface ReferenceFieldErrors {
  department?: string[];
  attendingDoctor?: string[];
}

/**
 * Validates patient department/attendingDoctor values against the reference
 * data. Fields left `undefined` are not validated (PUT sends partial bodies);
 * POST passes both because the schema requires them.
 *
 * Returns `null` when everything matches, otherwise a `details` map in the
 * same shape zod's `flatten().fieldErrors` uses, so routes can return it
 * without a second error format.
 */
export async function validatePatientReference(input: {
  department?: string;
  attendingDoctor?: string;
}): Promise<ReferenceFieldErrors | null> {
  const needsDepartment = input.department !== undefined;
  const needsDoctor = input.attendingDoctor !== undefined;
  if (!needsDepartment && !needsDoctor) {
    return null;
  }

  const options = await loadReferenceOptions();
  const errors: ReferenceFieldErrors = {};

  if (
    needsDepartment &&
    !options.departments.includes(input.department as string)
  ) {
    errors.department = ["Department does not exist"];
  }
  if (
    needsDoctor &&
    !options.doctors.includes(input.attendingDoctor as string)
  ) {
    errors.attendingDoctor = ["Attending doctor does not exist"];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

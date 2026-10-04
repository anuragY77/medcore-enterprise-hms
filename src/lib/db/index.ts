import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import {
  users,
  patients,
  patientAllergies,
  patientConditions,
  patientMedications,
  consultations,
  prescriptions,
  medicalRecords,
  vitals,
  staff,
  appointments,
  departments,
  beds,
  pharmacyMedicines,
  labTests,
  invoices,
  insuranceClaims,
  inventoryItems,
  emergencyCases,
  surgeries,
  auditLogs,
  notifications,
  loginRateLimits,
  businessIdCounters,
} from "./schema";

// Passing `schema` keeps the app handle's transaction type identical to the
// seed CLI's (`drizzle(url, { schema })`), so shared libraries can accept
// either handle without casts. Runtime behavior is unchanged.
const db = drizzle(process.env.DATABASE_URL!, { schema });

export {
  db,
  users,
  patients,
  patientAllergies,
  patientConditions,
  patientMedications,
  consultations,
  prescriptions,
  medicalRecords,
  vitals,
  staff,
  appointments,
  departments,
  beds,
  pharmacyMedicines,
  labTests,
  invoices,
  insuranceClaims,
  inventoryItems,
  emergencyCases,
  surgeries,
  auditLogs,
  notifications,
  loginRateLimits,
  businessIdCounters,
};

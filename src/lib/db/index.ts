import { drizzle } from "drizzle-orm/node-postgres";
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
} from "./schema";

const db = drizzle(process.env.DATABASE_URL!);

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
};

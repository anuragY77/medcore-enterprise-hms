import { drizzle } from "drizzle-orm/node-postgres";
import { users, patients, patientAllergies, patientConditions, patientMedications } from "./schema";

const db = drizzle(process.env.DATABASE_URL!);

export { db, users, patients, patientAllergies, patientConditions, patientMedications };

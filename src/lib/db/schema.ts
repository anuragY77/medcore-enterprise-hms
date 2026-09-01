import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  password: varchar("password", { length: 200 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  avatar: varchar("avatar", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const patients = pgTable("patients", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: varchar("patient_id", { length: 20 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: timestamp("date_of_birth").notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
  bloodGroup: varchar("blood_group", { length: 5 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 200 }),
  address: text("address"),
  department: varchar("department", { length: 100 }).notNull(),
  attendingDoctor: varchar("attending_doctor", { length: 200 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("Active"),
  insuranceProvider: varchar("insurance_provider", { length: 200 }),
  insurancePolicyNumber: varchar("insurance_policy_number", { length: 100 }),
  emergencyContactName: varchar("emergency_contact_name", { length: 200 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const patientAllergies = pgTable("patient_allergies", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  allergy: varchar("allergy", { length: 200 }).notNull(),
  severity: varchar("severity", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patientConditions = pgTable("patient_conditions", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  condition: varchar("condition", { length: 200 }).notNull(),
  diagnosedDate: timestamp("diagnosed_date"),
  status: varchar("status", { length: 20 }).default("Active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patientMedications = pgTable("patient_medications", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  medication: varchar("medication", { length: 200 }).notNull(),
  dosage: varchar("dosage", { length: 100 }),
  frequency: varchar("frequency", { length: 100 }),
  prescribedBy: varchar("prescribed_by", { length: 200 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

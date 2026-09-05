import { pgTable, uuid, varchar, text, integer, real, timestamp } from "drizzle-orm/pg-core";

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

export const consultations = pgTable("consultations", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  doctorName: varchar("doctor_name", { length: 200 }).notNull(),
  chiefComplaint: varchar("chief_complaint", { length: 500 }).notNull(),
  diagnosis: text("diagnosis").notNull(),
  treatmentPlan: text("treatment_plan"),
  notes: text("notes"),
  followUpDate: timestamp("follow_up_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  consultationId: uuid("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
  medicationName: varchar("medication_name", { length: 200 }).notNull(),
  dosage: varchar("dosage", { length: 100 }).notNull(),
  frequency: varchar("frequency", { length: 100 }).notNull(),
  duration: varchar("duration", { length: 100 }),
  instructions: text("instructions"),
  prescribedBy: varchar("prescribed_by", { length: 200 }).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 20 }).notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const medicalRecords = pgTable("medical_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  recordType: varchar("record_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  fileUrl: varchar("file_url", { length: 500 }),
  recordedBy: varchar("recorded_by", { length: 200 }).notNull(),
  recordDate: timestamp("record_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vitals = pgTable("vitals", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  bloodPressureSystolic: integer("blood_pressure_systolic"),
  bloodPressureDiastolic: integer("blood_pressure_diastolic"),
  heartRate: integer("heart_rate"),
  temperature: real("temperature"),
  respiratoryRate: integer("respiratory_rate"),
  oxygenSaturation: integer("oxygen_saturation"),
  weight: real("weight"),
  height: real("height"),
  recordedBy: varchar("recorded_by", { length: 200 }).notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  staffId: varchar("staff_id", { length: 20 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  specialization: varchar("specialization", { length: 200 }),
  qualification: varchar("qualification", { length: 200 }),
  experience: integer("experience"),
  status: varchar("status", { length: 20 }).notNull().default("Active"),
  joiningDate: timestamp("joining_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  appointmentId: varchar("appointment_id", { length: 20 }).notNull().unique(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  doctorName: varchar("doctor_name", { length: 200 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  date: timestamp("date").notNull(),
  time: varchar("time", { length: 20 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  reason: text("reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: varchar("department_id", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  headDoctor: varchar("head_doctor", { length: 200 }),
  phone: varchar("phone", { length: 20 }),
  location: varchar("location", { length: 200 }),
  totalBeds: integer("total_beds"),
  status: varchar("status", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const beds = pgTable("beds", {
  id: uuid("id").defaultRandom().primaryKey(),
  bedId: varchar("bed_id", { length: 20 }).notNull().unique(),
  roomNumber: varchar("room_number", { length: 20 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  ward: varchar("ward", { length: 100 }),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pharmacyMedicines = pgTable("pharmacy_medicines", {
  id: uuid("id").defaultRandom().primaryKey(),
  medicineId: varchar("medicine_id", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  genericName: varchar("generic_name", { length: 200 }),
  category: varchar("category", { length: 100 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 200 }),
  description: text("description"),
  dosage: varchar("dosage", { length: 100 }),
  unit: varchar("unit", { length: 50 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull(),
  reorderLevel: integer("reorder_level"),
  unitPrice: real("unit_price"),
  expiryDate: timestamp("expiry_date"),
  status: varchar("status", { length: 30 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const labTests = pgTable("lab_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  testId: varchar("test_id", { length: 20 }).notNull().unique(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  consultationId: uuid("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
  testName: varchar("test_name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  orderedBy: varchar("ordered_by", { length: 200 }),
  status: varchar("status", { length: 30 }).notNull(),
  result: text("result"),
  notes: text("notes"),
  testDate: timestamp("test_date").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: varchar("invoice_id", { length: 20 }).notNull().unique(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  description: text("description"),
  subtotal: real("subtotal").notNull(),
  taxAmount: real("tax_amount"),
  discountAmount: real("discount_amount"),
  totalAmount: real("total_amount").notNull(),
  paidAmount: real("paid_amount"),
  status: varchar("status", { length: 30 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  paidDate: timestamp("paid_date"),
  dueDate: timestamp("due_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insuranceClaims = pgTable("insurance_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimId: varchar("claim_id", { length: 20 }).notNull().unique(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  providerName: varchar("provider_name", { length: 200 }).notNull(),
  policyNumber: varchar("policy_number", { length: 100 }).notNull(),
  claimAmount: real("claim_amount").notNull(),
  approvedAmount: real("approved_amount"),
  status: varchar("status", { length: 30 }).notNull(),
  diagnosis: text("diagnosis"),
  treatmentCode: varchar("treatment_code", { length: 100 }),
  submittedDate: timestamp("submitted_date"),
  processedDate: timestamp("processed_date"),
  denialReason: text("denial_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: varchar("item_id", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description"),
  supplier: varchar("supplier", { length: 200 }),
  quantity: integer("quantity").notNull(),
  reorderLevel: integer("reorder_level"),
  unit: varchar("unit", { length: 50 }).notNull(),
  unitPrice: real("unit_price"),
  location: varchar("location", { length: 200 }),
  status: varchar("status", { length: 30 }).notNull(),
  lastRestockedAt: timestamp("last_restocked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

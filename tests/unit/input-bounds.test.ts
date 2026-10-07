// Phase 22: input-bound regression tests.
//
// Demonstrated failure classes (PostgreSQL errors seen from crafted input):
//   22001 varchar overflow  -> oversized strings (patients, staff, admission)
//   22003 real/int overflow -> money/quantity magnitudes beyond column range
//   22009 timestamp range   -> date strings JS parses but PostgreSQL rejects
//   unbounded text payloads -> diagnosis/notes/description without max
//   unbounded page          -> search schemas without the Phase 21 page cap
// Each failure previously surfaced as a 500 from the route handlers. These
// tests fail if the bounds are removed.
import { describe, expect, it } from "vitest";

import { patientSchema, patientSearchSchema } from "@/lib/validations/patient";
import {
  appointmentSchema,
  appointmentSearchSchema,
} from "@/lib/validations/appointment";
import { emergencyCaseSchema, emergencyCaseSearchSchema } from "@/lib/validations/emergency";
import { surgerySchema, surgerySearchSchema } from "@/lib/validations/surgery";
import { invoiceSchema, invoiceSearchSchema } from "@/lib/validations/billing";
import {
  insuranceClaimSchema,
  insuranceClaimSearchSchema,
} from "@/lib/validations/insurance";
import {
  inventoryItemSchema,
  inventoryItemSearchSchema,
} from "@/lib/validations/inventory";
import {
  pharmacyMedicineSchema,
  pharmacyMedicineSearchSchema,
  prescriptionQueueQuerySchema,
} from "@/lib/validations/pharmacy";
import { staffSchema, staffSearchSchema } from "@/lib/validations/staff";
import { bedSearchSchema } from "@/lib/validations/bed";
import { departmentSchema, departmentSearchSchema } from "@/lib/validations/department";
import { recordQuerySchema } from "@/lib/validations/record";
import { auditLogQuerySchema } from "@/lib/validations/audit-log";
import { notificationListQuerySchema } from "@/lib/validations/notification";
import { labTestSchema, labTestSearchSchema } from "@/lib/validations/laboratory";
import {
  admissionSchema,
  consultationSchema,
  dischargeSchema,
  prescriptionSchema,
} from "@/lib/validations/clinical";

const PATIENT_ID = "3f1d2a7c-9b64-4e21-8a5f-1c2d3e4f5a6b";
const STAFF_ID = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";

const repeat = (char: string, length: number) => char.repeat(length);

const validPatient = {
  firstName: "Ada",
  lastName: "Lovelace",
  dateOfBirth: "1990-01-01",
  gender: "Female" as const,
  phone: "+1234567890",
  department: "Cardiology",
  attendingDoctor: "Dr. Ada",
};

describe("patient field bounds (22001 class)", () => {
  it("accepts a fully valid patient", () => {
    expect(patientSchema.safeParse(validPatient).success).toBe(true);
  });

  it.each([
    ["bloodGroup", { bloodGroup: repeat("O", 6) }],
    ["department", { department: repeat("C", 101) }],
    ["attendingDoctor", { attendingDoctor: repeat("D", 201) }],
    ["insuranceProvider", { insuranceProvider: repeat("P", 201) }],
    ["insurancePolicyNumber", { insurancePolicyNumber: repeat("N", 101) }],
    ["emergencyContactName", { emergencyContactName: repeat("E", 201) }],
    ["emergencyContactPhone", { emergencyContactPhone: repeat("1", 21) }],
    ["address", { address: repeat("A", 20001) }],
    ["email", { email: `${repeat("a", 190)}@example.com` }],
  ])("rejects an oversized %s", (_field, patch) => {
    expect(patientSchema.safeParse({ ...validPatient, ...patch }).success).toBe(
      false
    );
  });
});

describe("date fields reject unparseable and out-of-range values (22009 class)", () => {
  it.each([
    "not-a-date",
    "-100000-01-01",
    "2024-13-45",
    repeat("9", 500),
  ])("rejects patient dateOfBirth %s", (value) => {
    expect(
      patientSchema.safeParse({ ...validPatient, dateOfBirth: value }).success
    ).toBe(false);
  });

  it.each(["not-a-date", "-100000-01-01", "2024-13-45"])(
    "rejects appointment date %s",
    (value) => {
      expect(
        appointmentSchema.safeParse({
          patientId: PATIENT_ID,
          doctorName: "Dr. Ada",
          department: "Cardiology",
          date: value,
          time: "10:00",
          type: "Consultation",
          status: "Scheduled",
        }).success
      ).toBe(false);
    }
  );

  it.each(["not-a-date", "-100000-01-01"])(
    "rejects emergency arrivalTime %s",
    (value) => {
      expect(
        emergencyCaseSchema.safeParse({
          patientId: PATIENT_ID,
          arrivalTime: value,
          triageLevel: 2,
          status: "Waiting",
          chiefComplaint: "Pain",
        }).success
      ).toBe(false);
    }
  );

  it.each(["not-a-date", "-100000-01-01"])(
    "rejects surgery surgeryDate %s",
    (value) => {
      expect(
        surgerySchema.safeParse({
          patientId: PATIENT_ID,
          surgeonId: STAFF_ID,
          procedureName: "Op",
          procedureType: "Cardiac",
          surgeryDate: value,
          department: "Cardiology",
          status: "Scheduled",
        }).success
      ).toBe(false);
    }
  );

  it("rejects audit log from/to outside the storable range", () => {
    expect(
      auditLogQuerySchema.safeParse({ from: "-100000-01-01" }).success
    ).toBe(false);
    expect(auditLogQuerySchema.safeParse({ from: "2026-01-01" }).success).toBe(
      true
    );
  });

  it("keeps the empty-string contract for optional dates", () => {
    expect(
      prescriptionSchema.safeParse({
        medicationName: "M",
        dosage: "1mg",
        frequency: "daily",
        prescribedBy: "Dr. Ada",
        startDate: "",
        endDate: "",
      }).success
    ).toBe(true);
    expect(
      prescriptionSchema.safeParse({
        medicationName: "M",
        dosage: "1mg",
        frequency: "daily",
        prescribedBy: "Dr. Ada",
        startDate: "garbage",
      }).success
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        patientId: PATIENT_ID,
        subtotal: 100,
        totalAmount: 100,
        status: "Pending",
        paidDate: "",
      }).success
    ).toBe(true);
    expect(
      invoiceSchema.safeParse({
        patientId: PATIENT_ID,
        subtotal: 100,
        totalAmount: 100,
        status: "Pending",
        paidDate: "garbage",
      }).success
    ).toBe(false);
  });
});

describe("clinical and operational text bounds", () => {
  it("rejects an oversized consultation diagnosis", () => {
    expect(
      consultationSchema.safeParse({
        doctorName: "Dr. Ada",
        chiefComplaint: "Pain",
        diagnosis: repeat("D", 20001),
      }).success
    ).toBe(false);
    expect(
      consultationSchema.safeParse({
        doctorName: "Dr. Ada",
        chiefComplaint: "Pain",
        diagnosis: repeat("D", 20000),
      }).success
    ).toBe(true);
  });

  it("rejects oversized admission fields that map to narrow columns", () => {
    expect(
      admissionSchema.safeParse({
        department: repeat("C", 101),
        attendingDoctor: "Dr. Ada",
        reason: "r",
      }).success
    ).toBe(false);
    expect(
      admissionSchema.safeParse({
        department: "Cardiology",
        attendingDoctor: repeat("D", 201),
        reason: "r",
      }).success
    ).toBe(false);
    expect(
      admissionSchema.safeParse({
        department: "Cardiology",
        attendingDoctor: "Dr. Ada",
        reason: repeat("R", 20001),
      }).success
    ).toBe(false);
  });

  it("rejects oversized discharge summary text", () => {
    expect(
      dischargeSchema.safeParse({
        diagnosis: repeat("D", 20001),
        treatmentSummary: "ok",
      }).success
    ).toBe(false);
  });

  it("rejects an oversized prescription duration (varchar 100)", () => {
    expect(
      prescriptionSchema.safeParse({
        medicationName: "M",
        dosage: "1mg",
        frequency: "daily",
        prescribedBy: "Dr. Ada",
        duration: repeat("d", 101),
      }).success
    ).toBe(false);
  });

  it("rejects an oversized lab notes field", () => {
    expect(
      labTestSchema.safeParse({
        patientId: PATIENT_ID,
        testName: "CBC",
        category: "Hematology",
        status: "Pending",
        testDate: "2026-10-06",
        notes: repeat("N", 20001),
      }).success
    ).toBe(false);
  });
});

describe("staff field bounds (22001 class)", () => {
  const validStaff = {
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.com",
    phone: "+1234567890",
    role: "Doctor",
    department: "Cardiology",
    status: "Active" as const,
  };

  it("accepts a fully valid staff member", () => {
    expect(staffSchema.safeParse(validStaff).success).toBe(true);
  });

  it.each([
    ["role", { role: repeat("R", 51) }],
    ["department", { department: repeat("D", 101) }],
    ["specialization", { specialization: repeat("S", 201) }],
    ["qualification", { qualification: repeat("Q", 201) }],
    ["email", { email: `${repeat("a", 190)}@example.com` }],
  ])("rejects an oversized %s", (_field, patch) => {
    expect(staffSchema.safeParse({ ...validStaff, ...patch }).success).toBe(
      false
    );
  });
});

describe("numeric bounds (22003 class)", () => {
  it("rejects money magnitudes beyond the real column range", () => {
    expect(
      invoiceSchema.safeParse({
        patientId: PATIENT_ID,
        subtotal: 1e100,
        totalAmount: 1e100,
        status: "Pending",
      }).success
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        patientId: PATIENT_ID,
        subtotal: 1000000001,
        totalAmount: 100,
        status: "Pending",
      }).success
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        patientId: PATIENT_ID,
        subtotal: 1000000000,
        totalAmount: 1000000000,
        status: "Pending",
      }).success
    ).toBe(true);
    expect(
      insuranceClaimSchema.safeParse({
        patientId: PATIENT_ID,
        providerName: "P",
        policyNumber: "1",
        claimAmount: 1e100,
        status: "Submitted",
      }).success
    ).toBe(false);
  });

  it("rejects integer quantities beyond the int4 column range", () => {
    expect(
      inventoryItemSchema.safeParse({
        name: "Gloves",
        category: "PPE",
        quantity: 1e10,
        unit: "box",
        status: "In Stock",
      }).success
    ).toBe(false);
    expect(
      inventoryItemSchema.safeParse({
        name: "Gloves",
        category: "PPE",
        quantity: 2147483648,
        unit: "box",
        status: "In Stock",
      }).success
    ).toBe(false);
    expect(
      pharmacyMedicineSchema.safeParse({
        name: "X",
        category: "General",
        unit: "mg",
        stockQuantity: 2147483648,
        status: "Active",
      }).success
    ).toBe(false);
    expect(
      surgerySchema.safeParse({
        patientId: PATIENT_ID,
        surgeonId: STAFF_ID,
        procedureName: "Op",
        procedureType: "Cardiac",
        surgeryDate: "2026-10-10",
        department: "Cardiology",
        status: "Scheduled",
        estimatedDuration: 2147483648,
      }).success
    ).toBe(false);
    expect(
      departmentSchema.safeParse({
        name: "Cardiology",
        status: "Active",
        totalBeds: 2147483648,
      }).success
    ).toBe(false);
    expect(
      staffSchema.safeParse({
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace@example.com",
        phone: "+1234567890",
        role: "Doctor",
        department: "Cardiology",
        status: "Active",
        experience: 2147483648,
      }).success
    ).toBe(false);
  });
});

describe("search pagination and query bounds (Phase 21/22 consistency)", () => {
  const overMax = 100001;

  it.each([
    ["appointmentSearchSchema", () => appointmentSearchSchema.safeParse({ page: overMax })],
    ["bedSearchSchema", () => bedSearchSchema.safeParse({ page: overMax })],
    ["invoiceSearchSchema", () => invoiceSearchSchema.safeParse({ page: overMax })],
    ["departmentSearchSchema", () => departmentSearchSchema.safeParse({ page: overMax })],
    ["emergencyCaseSearchSchema", () => emergencyCaseSearchSchema.safeParse({ page: overMax })],
    ["insuranceClaimSearchSchema", () => insuranceClaimSearchSchema.safeParse({ page: overMax })],
    ["inventoryItemSearchSchema", () => inventoryItemSearchSchema.safeParse({ page: overMax })],
    ["labTestSearchSchema", () => labTestSearchSchema.safeParse({ page: overMax })],
    ["pharmacyMedicineSearchSchema", () => pharmacyMedicineSearchSchema.safeParse({ page: overMax })],
    ["prescriptionQueueQuerySchema", () => prescriptionQueueQuerySchema.safeParse({ page: overMax })],
    ["recordQuerySchema", () => recordQuerySchema.safeParse({ page: overMax })],
    ["surgerySearchSchema", () => surgerySearchSchema.safeParse({ page: overMax })],
    ["auditLogQuerySchema", () => auditLogQuerySchema.safeParse({ page: overMax })],
    ["notificationListQuerySchema", () => notificationListQuerySchema.safeParse({ page: overMax })],
  ])("%s rejects page beyond the Phase 21 cap", (_name, run) => {
    expect(run().success).toBe(false);
  });

  it.each([
    ["appointmentSearchSchema", () => appointmentSearchSchema.safeParse({ page: 100000 })],
    ["recordQuerySchema", () => recordQuerySchema.safeParse({ page: 100000 })],
    ["auditLogQuerySchema", () => auditLogQuerySchema.safeParse({ page: 100000 })],
    ["notificationListQuerySchema", () => notificationListQuerySchema.safeParse({ page: 100000 })],
  ])("%s accepts page 100000", (_name, run) => {
    expect(run().success).toBe(true);
  });

  it("caps free-text search queries at 200 characters", () => {
    expect(
      appointmentSearchSchema.safeParse({ query: repeat("q", 201) }).success
    ).toBe(false);
    expect(
      labTestSearchSchema.safeParse({ query: repeat("q", 201) }).success
    ).toBe(false);
    expect(
      staffSearchSchema.safeParse({ query: repeat("q", 201) }).success
    ).toBe(false);
    expect(
      patientSearchSchema.safeParse({ query: repeat("q", 201) }).success
    ).toBe(false);
    expect(
      invoiceSearchSchema.safeParse({ query: repeat("q", 201) }).success
    ).toBe(false);
  });
});

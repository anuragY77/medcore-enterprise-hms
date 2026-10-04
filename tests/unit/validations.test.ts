import { describe, expect, it } from "vitest";
import { appointmentSchema } from "@/lib/validations/appointment";
import { invoiceSchema } from "@/lib/validations/billing";
import { idParamSchema, paginationSchema } from "@/lib/validations/common";
import {
  prescriptionSchema,
  vitalSchema,
} from "@/lib/validations/clinical";
import { patientSchema } from "@/lib/validations/patient";

const VALID_UUID = "3f1d3f0e-8f2f-4a7a-9a5a-1f2e3d4c5b6a";

const validPatient = {
  firstName: "Ada",
  lastName: "Lovelace",
  dateOfBirth: "1990-12-10",
  gender: "Female",
  phone: "555-0100",
  email: "ada@example.com",
  department: "Cardiology",
  attendingDoctor: "Dr. Test",
};

describe("patientSchema", () => {
  it("accepts a valid registration", () => {
    const result = patientSchema.safeParse(validPatient);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("Active");
  });

  it("defaults status to Active when omitted", () => {
    // validPatient carries no status key; safeParse must default it.
    const result = patientSchema.safeParse({ ...validPatient });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("Active");
  });

  it("preserves an explicitly provided status", () => {
    const result = patientSchema.safeParse({
      ...validPatient,
      status: "Critical",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("Critical");
  });

  it("rejects a missing required field", () => {
    const result = patientSchema.safeParse({
      ...validPatient,
      firstName: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.firstName).toBeDefined();
    }
  });

  it("rejects an empty required string", () => {
    const result = patientSchema.safeParse({ ...validPatient, firstName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid gender enum value", () => {
    const result = patientSchema.safeParse({ ...validPatient, gender: "Malee" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status enum value", () => {
    const result = patientSchema.safeParse({
      ...validPatient,
      status: "Deceased",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unparseable date of birth", () => {
    const result = patientSchema.safeParse({
      ...validPatient,
      dateOfBirth: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email but allows an empty optional email", () => {
    expect(
      patientSchema.safeParse({ ...validPatient, email: "nope" }).success
    ).toBe(false);
    expect(
      patientSchema.safeParse({ ...validPatient, email: "" }).success
    ).toBe(true);
  });

  it("enforces the 100-character boundary on names", () => {
    const long = "a".repeat(100);
    const ok = patientSchema.safeParse({ ...validPatient, firstName: long });
    expect(ok.success).toBe(true);
    const tooLong = "a".repeat(101);
    const bad = patientSchema.safeParse({
      ...validPatient,
      firstName: tooLong,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a non-string field", () => {
    const result = patientSchema.safeParse({ ...validPatient, phone: 12345 });
    expect(result.success).toBe(false);
  });
});

describe("appointmentSchema", () => {
  const valid = {
    patientId: VALID_UUID,
    doctorName: "Dr. Test",
    department: "Neurology",
    date: "2026-10-05",
    time: "10:30",
    type: "Consultation",
    status: "Scheduled",
  };

  it("accepts a valid appointment", () => {
    expect(appointmentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a malformed patient UUID", () => {
    const result = appointmentSchema.safeParse({
      ...valid,
      patientId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.patientId).toBeDefined();
    }
  });

  it("rejects invalid type and status enums", () => {
    expect(
      appointmentSchema.safeParse({ ...valid, type: "Checkup" }).success
    ).toBe(false);
    expect(
      appointmentSchema.safeParse({ ...valid, status: "Done" }).success
    ).toBe(false);
  });

  it("rejects missing scheduling fields", () => {
    expect(appointmentSchema.safeParse({ ...valid, time: undefined }).success).toBe(
      false
    );
  });
});

describe("invoiceSchema", () => {
  const valid = {
    patientId: VALID_UUID,
    subtotal: 250,
    totalAmount: 275,
    status: "Pending",
  };

  it("accepts a valid invoice with optional amounts omitted", () => {
    expect(invoiceSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts explicit null tax/discount/paid amounts", () => {
    const result = invoiceSchema.safeParse({
      ...valid,
      taxAmount: null,
      discountAmount: null,
      paidAmount: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero values", () => {
    expect(
      invoiceSchema.safeParse({
        ...valid,
        subtotal: 0,
        totalAmount: 0,
        paidAmount: 0,
      }).success
    ).toBe(true);
  });

  it("rejects negative amounts", () => {
    expect(invoiceSchema.safeParse({ ...valid, subtotal: -1 }).success).toBe(
      false
    );
    expect(invoiceSchema.safeParse({ ...valid, taxAmount: -0.01 }).success).toBe(
      false
    );
    expect(
      invoiceSchema.safeParse({ ...valid, discountAmount: -10 }).success
    ).toBe(false);
  });

  it("rejects a non-numeric amount and invalid status", () => {
    expect(
      invoiceSchema.safeParse({ ...valid, subtotal: "100" }).success
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({ ...valid, status: "Refunded" }).success
    ).toBe(false);
  });
});

describe("paginationSchema", () => {
  const schema = paginationSchema(10);

  it("applies defaults for omitted values", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("coerces query-string numbers", () => {
    const result = schema.safeParse({ page: "3", pageSize: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(5);
    }
  });

  it("rejects page below 1, non-integers, and non-numeric input", () => {
    expect(schema.safeParse({ page: 0 }).success).toBe(false);
    expect(schema.safeParse({ page: 1.5 }).success).toBe(false);
    expect(schema.safeParse({ page: "abc" }).success).toBe(false);
    expect(schema.safeParse({ pageSize: 0 }).success).toBe(false);
  });
});

describe("idParamSchema", () => {
  it("accepts a well-formed UUID", () => {
    expect(idParamSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it("rejects malformed identifiers", () => {
    expect(idParamSchema.safeParse({ id: "123" }).success).toBe(false);
    expect(
      idParamSchema.safeParse({ id: "3f1d3f0e8f2f4a7a9a5a1f2e3d4c5b6a" })
        .success
    ).toBe(false);
  });
});

describe("prescriptionSchema", () => {
  const valid = {
    medicationName: "Amoxicillin",
    dosage: "500mg",
    frequency: "Three times daily",
    prescribedBy: "Dr. Test",
  };

  it("accepts a valid prescription", () => {
    expect(prescriptionSchema.safeParse(valid).success).toBe(true);
  });

  it("allows an empty-string consultationId (form convention) but not garbage", () => {
    expect(
      prescriptionSchema.safeParse({ ...valid, consultationId: "" }).success
    ).toBe(true);
    expect(
      prescriptionSchema.safeParse({ ...valid, consultationId: "oops" })
        .success
    ).toBe(false);
  });

  it("rejects a missing dosage", () => {
    expect(prescriptionSchema.safeParse({ ...valid, dosage: undefined }).success).toBe(
      false
    );
  });
});

describe("vitalSchema boundaries", () => {
  const base = { recordedBy: "Nurse Test" };

  it("accepts SpO2 at both bounds and rejects out-of-range", () => {
    expect(vitalSchema.safeParse({ ...base, oxygenSaturation: 0 }).success).toBe(
      true
    );
    expect(vitalSchema.safeParse({ ...base, oxygenSaturation: 100 }).success).toBe(
      true
    );
    expect(vitalSchema.safeParse({ ...base, oxygenSaturation: 101 }).success).toBe(
      false
    );
  });

  it("rejects a non-integer heart rate", () => {
    expect(vitalSchema.safeParse({ ...base, heartRate: 72.5 }).success).toBe(
      false
    );
    expect(vitalSchema.safeParse({ ...base, heartRate: 29 }).success).toBe(false);
  });

  it("accepts null/omitted vitals (partial capture)", () => {
    expect(vitalSchema.safeParse(base).success).toBe(true);
    expect(vitalSchema.safeParse({ ...base, weight: null }).success).toBe(true);
  });
});

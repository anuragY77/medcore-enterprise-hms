import { z } from "zod";

export const consultationSchema = z.object({
  doctorName: z.string().min(1, "Doctor name is required").max(200),
  chiefComplaint: z.string().min(1, "Chief complaint is required").max(500),
  diagnosis: z.string().min(1, "Diagnosis is required"),
  treatmentPlan: z.string().optional(),
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
});

export type ConsultationFormData = z.infer<typeof consultationSchema>;

export const prescriptionSchema = z.object({
  medicationName: z.string().min(1, "Medication name is required").max(200),
  dosage: z.string().min(1, "Dosage is required").max(100),
  frequency: z.string().min(1, "Frequency is required").max(100),
  duration: z.string().optional(),
  instructions: z.string().optional(),
  prescribedBy: z.string().min(1, "Prescribing doctor is required").max(200),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  consultationId: z.string().uuid().optional().or(z.literal("")),
});

export type PrescriptionFormData = z.infer<typeof prescriptionSchema>;

export const medicalRecordSchema = z.object({
  recordType: z.enum(["Clinical", "Lab", "Imaging", "Administrative", "Discharge"], {
    message: "Record type is required",
  }),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  fileUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  recordedBy: z.string().min(1, "Recorded by is required").max(200),
  recordDate: z.string().optional(),
});

export type MedicalRecordFormData = z.infer<typeof medicalRecordSchema>;

export const vitalSchema = z.object({
  bloodPressureSystolic: z
    .number({ message: "Must be a number" })
    .int()
    .min(60, "Systolic must be at least 60")
    .max(300, "Systolic must be at most 300")
    .optional()
    .nullable(),
  bloodPressureDiastolic: z
    .number({ message: "Must be a number" })
    .int()
    .min(30, "Diastolic must be at least 30")
    .max(200, "Diastolic must be at most 200")
    .optional()
    .nullable(),
  heartRate: z
    .number({ message: "Must be a number" })
    .int()
    .min(30, "Heart rate must be at least 30")
    .max(300, "Heart rate must be at most 300")
    .optional()
    .nullable(),
  temperature: z
    .number({ message: "Must be a number" })
    .min(35, "Temperature must be at least 35°C")
    .max(42, "Temperature must be at most 42°C")
    .optional()
    .nullable(),
  respiratoryRate: z
    .number({ message: "Must be a number" })
    .int()
    .min(8, "Respiratory rate must be at least 8")
    .max(60, "Respiratory rate must be at most 60")
    .optional()
    .nullable(),
  oxygenSaturation: z
    .number({ message: "Must be a number" })
    .int()
    .min(0, "SpO2 must be at least 0")
    .max(100, "SpO2 must be at most 100")
    .optional()
    .nullable(),
  weight: z
    .number({ message: "Must be a number" })
    .min(0.5, "Weight must be at least 0.5 kg")
    .max(500, "Weight must be at most 500 kg")
    .optional()
    .nullable(),
  height: z
    .number({ message: "Must be a number" })
    .min(20, "Height must be at least 20 cm")
    .max(300, "Height must be at most 300 cm")
    .optional()
    .nullable(),
  recordedBy: z.string().min(1, "Recorded by is required").max(200),
  recordedAt: z.string().optional(),
});

export type VitalFormData = z.infer<typeof vitalSchema>;

export const dischargeSchema = z.object({
  diagnosis: z.string().min(1, "Discharge diagnosis is required"),
  treatmentSummary: z.string().min(1, "Treatment summary is required"),
  followUpInstructions: z.string().optional(),
  medicationsOnDischarge: z.string().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
});

export type DischargeFormData = z.infer<typeof dischargeSchema>;

export const admissionSchema = z.object({
  department: z.string().min(1, "Department is required"),
  attendingDoctor: z.string().min(1, "Attending doctor is required"),
  reason: z.string().min(1, "Admission reason is required"),
  notes: z.string().optional(),
});

export type AdmissionFormData = z.infer<typeof admissionSchema>;

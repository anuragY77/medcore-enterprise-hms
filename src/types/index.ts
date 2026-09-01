export interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "Male" | "Female" | "Other";
  bloodGroup?: string;
  phone: string;
  email?: string;
  address?: string;
  department: string;
  attendingDoctor: string;
  status: "Active" | "Discharged" | "Critical" | "In Progress";
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientAllergy {
  id: string;
  patientId: string;
  allergy: string;
  severity?: string;
}

export interface PatientCondition {
  id: string;
  patientId: string;
  condition: string;
  diagnosedDate?: string;
  status?: string;
}

export interface PatientMedication {
  id: string;
  patientId: string;
  medication: string;
  dosage?: string;
  frequency?: string;
  prescribedBy?: string;
  startDate?: string;
  endDate?: string;
}

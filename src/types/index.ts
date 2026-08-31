export interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "Male" | "Female" | "Other";
  bloodGroup: string;
  phone: string;
  email?: string;
  address?: string;
  allergies?: string[];
  activeConditions?: string[];
  currentMedications?: string[];
  department: string;
  attendingDoctor: string;
  status: "Active" | "Discharged" | "Critical" | "In Progress";
}

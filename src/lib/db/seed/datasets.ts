/**
 * Static datasets for the MedCore demo seed.
 *
 * Demographics are deliberately India-majority (≈85% of patients/staff) with
 * a small international group, per the demo-data brief. Every entry is plain
 * data — no I/O, no randomness — so seed runs are repeatable.
 */

export const DEMO_PASSWORD = "medcore123";

export interface DemoUserSeed {
  email: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
}

/** The five demo accounts. The administrator identity is Anurag Yadav. */
export const DEMO_USERS: DemoUserSeed[] = [
  {
    email: "admin@medcore.com",
    name: "Anurag Yadav",
    role: "ADMIN",
    department: "Administration",
    avatar: "AY",
  },
  {
    email: "doctor@medcore.com",
    name: "Dr. James Wilson",
    role: "DOCTOR",
    department: "Cardiology",
    avatar: "JW",
  },
  {
    email: "nurse@medcore.com",
    name: "Nurse Emily Chen",
    role: "NURSE",
    department: "Emergency",
    avatar: "EC",
  },
  {
    email: "reception@medcore.com",
    name: "Maria Garcia",
    role: "RECEPTIONIST",
    department: "Front Desk",
    avatar: "MG",
  },
  {
    email: "pharmacy@medcore.com",
    name: "Pharm. David Kim",
    role: "PHARMACIST",
    department: "Pharmacy",
    avatar: "DK",
  },
];

/** Slot strings match the appointment form's TIME_SLOTS (24h "HH:MM"). */
export const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30",
];

export interface DepartmentSeed {
  name: string;
  description: string;
  location: string;
  /** Bed counts by type; sums to the department's bed total. */
  bedTypes: Partial<Record<"General" | "ICU" | "Semi-Private" | "Private", number>>;
}

export const DEPARTMENTS: DepartmentSeed[] = [
  {
    name: "Cardiology",
    description: "Cardiac care, cath lab and telemetry monitoring.",
    location: "Block A, 2nd Floor",
    bedTypes: { General: 8, "Semi-Private": 4, Private: 2, ICU: 2 },
  },
  {
    name: "Neurology",
    description: "Stroke care, epilepsy and neurological disorders.",
    location: "Block A, 3rd Floor",
    bedTypes: { General: 7, "Semi-Private": 3, Private: 2 },
  },
  {
    name: "Orthopedics",
    description: "Fracture care, joint replacement and sports injuries.",
    location: "Block B, 2nd Floor",
    bedTypes: { General: 8, "Semi-Private": 4, Private: 2 },
  },
  {
    name: "Pediatrics",
    description: "Newborn, infant and child healthcare.",
    location: "Block B, 1st Floor",
    bedTypes: { General: 6, "Semi-Private": 2, Private: 2 },
  },
  {
    name: "Emergency",
    description: "24x7 emergency and trauma care.",
    location: "Ground Floor, East Wing",
    bedTypes: { General: 10, ICU: 4 },
  },
  {
    name: "ICU",
    description: "Intensive care with ventilator support.",
    location: "Block A, Ground Floor",
    bedTypes: { ICU: 12 },
  },
  {
    name: "General Medicine",
    description: "General admissions and internal medicine.",
    location: "Block C, 1st & 2nd Floor",
    bedTypes: { General: 10, "Semi-Private": 4, Private: 2 },
  },
  { name: "Radiology", description: "Imaging, X-ray, CT and MRI services.", location: "Block C, Ground Floor", bedTypes: {} },
  { name: "Laboratory", description: "Pathology, biochemistry and microbiology.", location: "Block C, Ground Floor", bedTypes: {} },
  { name: "Pharmacy", description: "Inpatient and outpatient pharmacy.", location: "Main Lobby", bedTypes: {} },
  { name: "Administration", description: "Hospital administration and records.", location: "Block D, 3rd Floor", bedTypes: {} },
  { name: "Nursing", description: "Nursing services and ward coordination.", location: "Block A, 1st Floor", bedTypes: {} },
];

/** Departments that admit patients (drive beds, admissions, appointments). */
export const CLINICAL_DEPARTMENTS = [
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Emergency",
  "ICU",
  "General Medicine",
];

/** Weighted ward list used for ward-admitted demo patients. */
export const INDIA_ADMIT_DEPARTMENTS = [
  "General Medicine",
  "General Medicine",
  "Cardiology",
  "Cardiology",
  "Orthopedics",
  "Orthopedics",
  "Neurology",
  "Pediatrics",
  "Emergency",
];

/** Department filter list used by the appointment form. */
export const APPOINTMENT_DEPARTMENTS = [
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Emergency",
  "Radiology",
  "Laboratory",
  "Pharmacy",
  "Administration",
  "Nursing",
];

export interface StaffSeed {
  staffId: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  specialization: string;
  qualification: string;
  experience: number;
  phone: string;
  /** Days before the run date that this person joined. */
  joinedDaysAgo: number;
}

/** 10 doctors (9 Indian, 1 international), 6 nurses, 2 technicians. */
export const STAFF_SEED: StaffSeed[] = [
  { staffId: "STF-001", firstName: "Arjun", lastName: "Mehta", role: "Doctor", department: "Cardiology", specialization: "Interventional Cardiology", qualification: "MD, DM (Cardiology)", experience: 16, phone: "+91 98200 11001", joinedDaysAgo: 2400 },
  { staffId: "STF-002", firstName: "Priya", lastName: "Sharma", role: "Doctor", department: "Cardiology", specialization: "Non-invasive Cardiology", qualification: "MBBS, MD", experience: 11, phone: "+91 98200 11002", joinedDaysAgo: 1700 },
  { staffId: "STF-003", firstName: "Vikram", lastName: "Rao", role: "Doctor", department: "Neurology", specialization: "Stroke Medicine", qualification: "MBBS, MD, DM (Neurology)", experience: 14, phone: "+91 98200 11003", joinedDaysAgo: 2100 },
  { staffId: "STF-004", firstName: "Sanjay", lastName: "Deshmukh", role: "Doctor", department: "Orthopedics", specialization: "Joint Replacement", qualification: "MBBS, MS (Ortho)", experience: 18, phone: "+91 98200 11004", joinedDaysAgo: 2600 },
  { staffId: "STF-005", firstName: "Ananya", lastName: "Banerjee", role: "Doctor", department: "Pediatrics", specialization: "Pediatric Pulmonology", qualification: "MBBS, MD (Pediatrics)", experience: 9, phone: "+91 98200 11005", joinedDaysAgo: 1300 },
  { staffId: "STF-006", firstName: "Rohan", lastName: "Nair", role: "Doctor", department: "General Medicine", specialization: "Internal Medicine", qualification: "MBBS, MD", experience: 12, phone: "+91 98200 11006", joinedDaysAgo: 1900 },
  { staffId: "STF-007", firstName: "Meera", lastName: "Krishnan", role: "Doctor", department: "ICU", specialization: "Critical Care Medicine", qualification: "MBBS, MD, IDCCM", experience: 13, phone: "+91 98200 11007", joinedDaysAgo: 2000 },
  { staffId: "STF-008", firstName: "Imran", lastName: "Qureshi", role: "Doctor", department: "Emergency", specialization: "Emergency Medicine", qualification: "MBBS, MD (Emergency)", experience: 10, phone: "+91 98200 11008", joinedDaysAgo: 1500 },
  { staffId: "STF-009", firstName: "Neha", lastName: "Bhatt", role: "Doctor", department: "Radiology", specialization: "Diagnostic Radiology", qualification: "MBBS, MD (Radiodiagnosis)", experience: 8, phone: "+91 98200 11009", joinedDaysAgo: 1100 },
  { staffId: "STF-010", firstName: "Elena", lastName: "Rossi", role: "Doctor", department: "General Medicine", specialization: "Internal Medicine", qualification: "MD (Bologna), MRCP", experience: 15, phone: "+91 98200 11010", joinedDaysAgo: 900 },
  { staffId: "STF-011", firstName: "Anita", lastName: "Kulkarni", role: "Nurse", department: "ICU", specialization: "Critical Care Nursing", qualification: "BSc Nursing, CCRN", experience: 12, phone: "+91 98200 12001", joinedDaysAgo: 1800 },
  { staffId: "STF-012", firstName: "Deepa", lastName: "Menon", role: "Nurse", department: "Cardiology", specialization: "Telemetry Nursing", qualification: "BSc Nursing", experience: 8, phone: "+91 98200 12002", joinedDaysAgo: 1200 },
  { staffId: "STF-013", firstName: "Sunita", lastName: "Yadav", role: "Nurse", department: "Emergency", specialization: "Triage Nursing", qualification: "GNM", experience: 10, phone: "+91 98200 12003", joinedDaysAgo: 1600 },
  { staffId: "STF-014", firstName: "Ritu", lastName: "Singh", role: "Nurse", department: "Pediatrics", specialization: "Pediatric Nursing", qualification: "BSc Nursing", experience: 6, phone: "+91 98200 12004", joinedDaysAgo: 800 },
  { staffId: "STF-015", firstName: "Farhan", lastName: "Sheikh", role: "Nurse", department: "General Medicine", specialization: "Medical-Surgical Nursing", qualification: "GNM", experience: 7, phone: "+91 98200 12005", joinedDaysAgo: 1000 },
  { staffId: "STF-016", firstName: "Pooja", lastName: "Joshi", role: "Nurse", department: "Orthopedics", specialization: "Orthopedic Nursing", qualification: "BSc Nursing", experience: 5, phone: "+91 98200 12006", joinedDaysAgo: 700 },
  { staffId: "STF-017", firstName: "Rakesh", lastName: "Patil", role: "Lab Technician", department: "Laboratory", specialization: "Clinical Pathology", qualification: "DMLT", experience: 9, phone: "+91 98200 13001", joinedDaysAgo: 1400 },
  { staffId: "STF-018", firstName: "Sneha", lastName: "Ganguly", role: "Radiology Technician", department: "Radiology", specialization: "X-ray & CT", qualification: "DMLT, DMRD", experience: 7, phone: "+91 98200 13002", joinedDaysAgo: 950 },
];

export const INDIAN_MALE_FIRST = [
  "Aarav", "Vihaan", "Rohan", "Kabir", "Aditya", "Ishaan", "Krishna", "Arnav",
  "Dev", "Yash", "Rahul", "Amit", "Nikhil", "Siddharth", "Manish", "Tarun",
  "Gaurav", "Harsh", "Parth", "Vivek", "Karan", "Sagar", "Naveen", "Pranav",
  "Om", "Reyansh", "Atharv", "Darsh", "Lakshya", "Neel", "Shreyas", "Uday",
  "Varun", "Zaid",
];

export const INDIAN_FEMALE_FIRST = [
  "Aanya", "Diya", "Ira", "Myra", "Sara", "Anika", "Navya", "Kiara",
  "Pari", "Ananya", "Meera", "Kavya", "Riya", "Shreya", "Tanvi", "Ishita",
  "Nandini", "Pooja", "Swati", "Deepika", "Ritika", "Simran", "Vaishnavi",
  "Aishwarya", "Bhavna", "Chitra", "Divya", "Ekta", "Gauri", "Harini",
  "Jhanvi", "Lakshmi", "Mitali", "Neha",
];

export const INDIAN_LAST = [
  "Sharma", "Verma", "Patel", "Reddy", "Nair", "Iyer", "Kulkarni", "Deshmukh",
  "Chatterjee", "Banerjee", "Joshi", "Mehta", "Shetty", "Gowda", "Malhotra",
  "Kapoor", "Saxena", "Trivedi", "Pandey", "Chauhan", "Rathore", "Sinha",
  "Mishra", "Dubey", "Agarwal", "Bansal", "Gupta", "Singh", "Yadav", "Kumar",
  "Das", "Rao", "Pillai", "Menon", "Bhatt", "Shah", "Shinde", "Gaikwad",
  "Kaur", "Chopra",
];

export interface InternationalPatientSeed {
  firstName: string;
  lastName: string;
  gender: "Male" | "Female";
  dob: string;
  phone: string;
  city: string;
}

/** The small international group (12 of 80 patients). */
export const INTERNATIONAL_PATIENTS: InternationalPatientSeed[] = [
  { firstName: "Yuki", lastName: "Tanaka", gender: "Female", dob: "1991-04-12", phone: "+81 90-1234-5678", city: "Mumbai" },
  { firstName: "David", lastName: "Miller", gender: "Male", dob: "1978-11-03", phone: "+44 7700 900341", city: "Mumbai" },
  { firstName: "Chidinma", lastName: "Okafor", gender: "Female", dob: "1995-06-21", phone: "+234 802 118 4477", city: "Bengaluru" },
  { firstName: "Hans", lastName: "Muller", gender: "Male", dob: "1966-02-09", phone: "+49 151 23456789", city: "Pune" },
  { firstName: "Fatima", lastName: "Al-Saud", gender: "Female", dob: "1988-09-30", phone: "+966 55 123 4567", city: "Hyderabad" },
  { firstName: "Liam", lastName: "O'Connor", gender: "Male", dob: "2001-12-15", phone: "+353 85 123 4567", city: "Delhi" },
  { firstName: "Mei Lin", lastName: "Chen", gender: "Female", dob: "1984-07-08", phone: "+65 9123 4567", city: "Chennai" },
  { firstName: "Carlos", lastName: "Mendoza", gender: "Male", dob: "1973-03-27", phone: "+52 55 1234 5678", city: "Kolkata" },
  { firstName: "Anna", lastName: "Kowalska", gender: "Female", dob: "1997-08-19", phone: "+48 501 234 567", city: "Ahmedabad" },
  { firstName: "Kwame", lastName: "Mensah", gender: "Male", dob: "1990-01-25", phone: "+233 24 123 4567", city: "Jaipur" },
  { firstName: "Sophie", lastName: "Dubois", gender: "Female", dob: "1982-05-14", phone: "+33 6 12 34 56 78", city: "Kochi" },
  { firstName: "Ahmed", lastName: "Haddad", gender: "Male", dob: "1976-10-05", phone: "+20 100 123 4567", city: "Lucknow" },
];

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export const CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune",
  "Kolkata", "Ahmedabad", "Jaipur", "Lucknow", "Surat", "Indore",
  "Nagpur", "Bhopal", "Patna", "Chandigarh",
];

export const STREETS = [
  "MG Road", "Station Road", "Civil Lines", "Gandhi Nagar", "Lake View Road",
  "Market Street", "Hill View Road", "Ring Road", "Temple Street", "River Side",
];

export const INSURANCE_PROVIDERS = [
  "Star Health and Allied Insurance",
  "HDFC ERGO General Insurance",
  "ICICI Lombard General Insurance",
  "The New India Assurance Co.",
  "Bajaj Allianz General Insurance",
  "Care Health Insurance",
  "Niva Bupa Health Insurance",
];

export const ALLERGY_SEEDS: { allergy: string; severity: string }[] = [
  { allergy: "Penicillin", severity: "Severe" },
  { allergy: "Sulfa drugs", severity: "Moderate" },
  { allergy: "Latex", severity: "Moderate" },
  { allergy: "Peanuts", severity: "Severe" },
  { allergy: "Dust mite", severity: "Mild" },
  { allergy: "Pollen", severity: "Mild" },
  { allergy: "Ibuprofen", severity: "Moderate" },
  { allergy: "Seafood", severity: "Severe" },
  { allergy: "Egg", severity: "Mild" },
  { allergy: "Milk protein", severity: "Moderate" },
  { allergy: "Contrast dye", severity: "Severe" },
  { allergy: "Formaldehyde", severity: "Mild" },
];

export const CONDITION_SEEDS: { condition: string; status: string }[] = [
  { condition: "Hypertension", status: "Active" },
  { condition: "Type 2 Diabetes Mellitus", status: "Active" },
  { condition: "Bronchial Asthma", status: "Active" },
  { condition: "Hypothyroidism", status: "Managed" },
  { condition: "Coronary Artery Disease", status: "Active" },
  { condition: "Osteoarthritis", status: "Active" },
  { condition: "Chronic Kidney Disease (Stage 2)", status: "Managed" },
  { condition: "Gastroesophageal Reflux Disease", status: "Active" },
  { condition: "Migraine", status: "Managed" },
  { condition: "Iron Deficiency Anemia", status: "Resolved" },
  { condition: "Hyperlipidemia", status: "Active" },
  { condition: "Allergic Rhinitis", status: "Managed" },
  { condition: "Atrial Fibrillation", status: "Active" },
  { condition: "COPD", status: "Active" },
  { condition: "Depression", status: "Managed" },
  { condition: "Gout", status: "Resolved" },
];

export const CURRENT_MEDICATION_SEEDS: {
  medication: string;
  dosage: string;
  frequency: string;
}[] = [
  { medication: "Metformin", dosage: "500 mg", frequency: "Twice daily" },
  { medication: "Amlodipine", dosage: "5 mg", frequency: "Once daily" },
  { medication: "Levothyroxine", dosage: "50 mcg", frequency: "Once daily" },
  { medication: "Atorvastatin", dosage: "10 mg", frequency: "At bedtime" },
  { medication: "Telmisartan", dosage: "40 mg", frequency: "Once daily" },
  { medication: "Pantoprazole", dosage: "40 mg", frequency: "Before breakfast" },
  { medication: "Aspirin", dosage: "75 mg", frequency: "Once daily" },
  { medication: "Salbutamol Inhaler", dosage: "2 puffs", frequency: "As needed" },
  { medication: "Sertraline", dosage: "50 mg", frequency: "Once daily" },
  { medication: "Ferrous Ascorbate", dosage: "1 tablet", frequency: "Once daily" },
  { medication: "Insulin Glargine", dosage: "10 units", frequency: "At bedtime" },
  { medication: "Paracetamol", dosage: "650 mg", frequency: "Every 8 hours" },
];

export const CHIEF_COMPLAINTS = [
  "Chest tightness on exertion",
  "Persistent dry cough for 2 weeks",
  "Severe headache with nausea",
  "Knee pain while climbing stairs",
  "Fever with chills for 3 days",
  "Breathlessness on lying flat",
  "Epigastric pain relieved by food",
  "Lower back pain radiating to left leg",
  "Palpitations since yesterday",
  "Loose stools and dehydration",
  "Blurred vision in right eye",
  "Swelling of both ankles",
  "Intermittent abdominal pain",
  "Fatigue and weight loss over a month",
  "Reduced range of motion in shoulder",
  "Dizziness on standing up",
  "Skin rash with itching",
  "Known diabetic with raised fasting sugar",
];

export const DIAGNOSES = [
  "Stable angina, exertional",
  "Community acquired pneumonia",
  "Migraine without aura",
  "Osteoarthritis, right knee",
  "Dengue fever, without warning signs",
  "Congestive heart failure, NYHA class II",
  "Duodenal ulcer",
  "Lumbar disc prolapse (L4-L5)",
  "Paroxysmal supraventricular tachycardia",
  "Acute gastroenteritis",
  "Diabetic retinopathy, background stage",
  "Decompensated heart failure",
  "Irritable bowel syndrome",
  "Hypothyroidism with fatigue",
  "Frozen shoulder, left",
  "Orthostatic hypotension",
  "Contact dermatitis",
  "Poorly controlled type 2 diabetes",
];

export const TREATMENT_PLANS = [
  "Start antiplatelet therapy, ECHO within 24 hours, cardiology review.",
  "Oral antibiotics for 5 days, hydration, repeat chest X-ray after a week.",
  "Analgesics, hydration, trigger-avoidance diary, follow-up in 2 weeks.",
  "Physiotherapy, intra-articular hyaluronic acid, weight reduction advice.",
  "IV fluids, paracetamol, daily CBC monitoring, platelet watch.",
  "Diuretic titration, salt restriction, daily weight log, ECHO review.",
  "Proton pump inhibitor for 4 weeks, H. pylori eradication if positive.",
  "NSAIDs, lumbar support belt, supervised physiotherapy for 6 weeks.",
  "Rate control with beta-blocker, electrolyte correction, ECG follow-up.",
  "ORS and zinc, bland diet, stool culture if symptoms persist.",
  "Strict glycemic control, ophthalmology referral, HbA1c in 3 months.",
  "Fluid restriction, ACE inhibitor optimization, low-sodium diet.",
  "FODMAP diet trial, antispasmodics, stress management advice.",
  "Levothyroxine dose optimization, repeat TSH in 6 weeks.",
  "Pendulum exercises, gentle stretching, analgesics as needed.",
  "Increase fluid intake, compression stockings, postural training.",
  "Topical corticosteroid, emollients, allergen avoidance.",
  "Metformin uptitration, diet counselling, SMBG review.",
];

export const CLINICAL_NOTE_TITLES = [
  "Progress note",
  "Consultation note",
  "Nursing note",
  "Specialist review",
  "Pre-procedure assessment",
  "Dietitian note",
  "Physiotherapy note",
  "Wound care note",
];

export const DISCHARGE_INSTRUCTIONS = [
  "Continue medications as prescribed. Follow up in OPD after 7 days.",
  "Half-salt diet, daily weight monitoring, return if breathlessness worsens.",
  "Wound care instructions given. Suture removal after 10 days.",
  "Physiotherapy home program twice daily. Avoid heavy lifting for 4 weeks.",
  "Monitor blood glucose fasting and post-meal. Review after 2 weeks.",
  "Stay hydrated. Report persistent fever or bleeding immediately.",
];

export interface MedicineSeed {
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  dosage: string;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  unitPrice: number;
  monthsToExpiry: number;
}

/** 24 real-world Indian-market medicines (brands used across prescriptions). */
export const MEDICINES: MedicineSeed[] = [
  { name: "Dolo 650", genericName: "Paracetamol", category: "Analgesic", manufacturer: "Micro Labs", dosage: "650 mg", unit: "Tablet", stockQuantity: 420, reorderLevel: 80, unitPrice: 32.5, monthsToExpiry: 18 },
  { name: "Azithral 500", genericName: "Azithromycin", category: "Antibiotic", manufacturer: "Alembic", dosage: "500 mg", unit: "Tablet", stockQuantity: 260, reorderLevel: 60, unitPrice: 118, monthsToExpiry: 14 },
  { name: "Pan-D", genericName: "Pantoprazole + Domperidone", category: "Gastroenterology", manufacturer: "Alkem", dosage: "40 mg", unit: "Capsule", stockQuantity: 300, reorderLevel: 70, unitPrice: 96, monthsToExpiry: 16 },
  { name: "Shelcal-500", genericName: "Calcium Carbonate + Vitamin D3", category: "Vitamins", manufacturer: "Torrent", dosage: "500 mg", unit: "Tablet", stockQuantity: 350, reorderLevel: 80, unitPrice: 68, monthsToExpiry: 20 },
  { name: "Augmentin 625", genericName: "Amoxicillin + Clavulanate", category: "Antibiotic", manufacturer: "GSK", dosage: "625 mg", unit: "Tablet", stockQuantity: 180, reorderLevel: 50, unitPrice: 178, monthsToExpiry: 12 },
  { name: "Telma 40", genericName: "Telmisartan", category: "Cardiovascular", manufacturer: "Glenmark", dosage: "40 mg", unit: "Tablet", stockQuantity: 240, reorderLevel: 60, unitPrice: 84, monthsToExpiry: 18 },
  { name: "Ecosprin 75", genericName: "Aspirin", category: "Cardiovascular", manufacturer: "USV", dosage: "75 mg", unit: "Tablet", stockQuantity: 500, reorderLevel: 100, unitPrice: 12, monthsToExpiry: 24 },
  { name: "Glycomet GP 1", genericName: "Metformin + Glimepiride", category: "Antidiabetic", manufacturer: "USV", dosage: "1 mg", unit: "Tablet", stockQuantity: 280, reorderLevel: 70, unitPrice: 74, monthsToExpiry: 18 },
  { name: "Montair-LC", genericName: "Montelukast + Levocetirizine", category: "Respiratory", manufacturer: "Cipla", dosage: "10 mg", unit: "Tablet", stockQuantity: 210, reorderLevel: 60, unitPrice: 142, monthsToExpiry: 14 },
  { name: "Zincovit", genericName: "Multivitamin + Zinc", category: "Vitamins", manufacturer: "Apex Labs", dosage: "—", unit: "Tablet", stockQuantity: 400, reorderLevel: 90, unitPrice: 58, monthsToExpiry: 22 },
  { name: "Levoflox 500", genericName: "Levofloxacin", category: "Antibiotic", manufacturer: "Cipla", dosage: "500 mg", unit: "Tablet", stockQuantity: 150, reorderLevel: 40, unitPrice: 96, monthsToExpiry: 12 },
  { name: "Atorva 10", genericName: "Atorvastatin", category: "Cardiovascular", manufacturer: "Sun Pharma", dosage: "10 mg", unit: "Tablet", stockQuantity: 320, reorderLevel: 70, unitPrice: 88, monthsToExpiry: 20 },
  { name: "Pantocid 40", genericName: "Pantoprazole", category: "Gastroenterology", manufacturer: "Sun Pharma", dosage: "40 mg", unit: "Tablet", stockQuantity: 275, reorderLevel: 65, unitPrice: 62, monthsToExpiry: 16 },
  { name: "Mox 500", genericName: "Moxifloxacin", category: "Antibiotic", manufacturer: "Cipla", dosage: "500 mg", unit: "Tablet", stockQuantity: 140, reorderLevel: 40, unitPrice: 132, monthsToExpiry: 12 },
  { name: "Thyronorm 50", genericName: "Levothyroxine", category: "Endocrine", manufacturer: "Abbott", dosage: "50 mcg", unit: "Tablet", stockQuantity: 260, reorderLevel: 60, unitPrice: 118, monthsToExpiry: 18 },
  { name: "Mixtard 30/70", genericName: "Human Insulin", category: "Antidiabetic", manufacturer: "Novo Nordisk", dosage: "100 IU/ml", unit: "Vial", stockQuantity: 60, reorderLevel: 15, unitPrice: 430, monthsToExpiry: 10 },
  { name: "Allegra 120", genericName: "Fexofenadine", category: "Antihistamine", manufacturer: "Sanofi", dosage: "120 mg", unit: "Tablet", stockQuantity: 230, reorderLevel: 60, unitPrice: 105, monthsToExpiry: 16 },
  { name: "Gelusil MPS", genericName: "Magnesium + Simethicone + Antacid", category: "Gastroenterology", manufacturer: "Pfizer", dosage: "—", unit: "Bottle", stockQuantity: 150, reorderLevel: 40, unitPrice: 78, monthsToExpiry: 14 },
  { name: "Betadine 100 ml", genericName: "Povidone Iodine", category: "Antiseptic", manufacturer: "Win-Medicare", dosage: "10% w/v", unit: "Bottle", stockQuantity: 90, reorderLevel: 25, unitPrice: 145, monthsToExpiry: 20 },
  { name: "Cifran 500", genericName: "Ciprofloxacin", category: "Antibiotic", manufacturer: "Cipla", dosage: "500 mg", unit: "Tablet", stockQuantity: 170, reorderLevel: 45, unitPrice: 74, monthsToExpiry: 13 },
  { name: "Lasix 40", genericName: "Furosemide", category: "Cardiovascular", manufacturer: "Sanofi", dosage: "40 mg", unit: "Tablet", stockQuantity: 120, reorderLevel: 35, unitPrice: 48, monthsToExpiry: 15 },
  { name: "Zincofer", genericName: "Iron + Folic Acid + Zinc", category: "Hematinic", manufacturer: "Mankind", dosage: "100 mg", unit: "Tablet", stockQuantity: 340, reorderLevel: 80, unitPrice: 35, monthsToExpiry: 20 },
  { name: "Volini Gel 30 g", genericName: "Diclofenac Diethylamine", category: "Analgesic", manufacturer: "Sun Pharma", dosage: "1.16% w/w", unit: "Tube", stockQuantity: 110, reorderLevel: 30, unitPrice: 92, monthsToExpiry: 16 },
  { name: "Combiflam", genericName: "Ibuprofen + Paracetamol", category: "Analgesic", manufacturer: "Sanofi", dosage: "400 mg", unit: "Tablet", stockQuantity: 380, reorderLevel: 90, unitPrice: 44, monthsToExpiry: 22 },
];

export interface InventorySeed {
  name: string;
  category: string;
  description: string;
  supplier: string;
  quantity: number;
  reorderLevel: number;
  unit: string;
  unitPrice: number;
}

export const INVENTORY_ITEMS: InventorySeed[] = [
  { name: "Examination Gloves (Box of 100)", category: "Consumables", description: "Nitrile, powder-free, size M.", supplier: "Medline India", quantity: 48, reorderLevel: 15, unit: "Box", unitPrice: 420 },
  { name: "Surgical Face Mask (Box of 50)", category: "Consumables", description: "3-ply disposable mask with ear loops.", supplier: "Medline India", quantity: 60, reorderLevel: 20, unit: "Box", unitPrice: 165 },
  { name: "N95 Respirator (Box of 20)", category: "PPE", description: "NIOSH-approved N95 respirator.", supplier: "Hindustan Surgical", quantity: 14, reorderLevel: 10, unit: "Box", unitPrice: 540 },
  { name: "Syringe 5 ml (Box of 100)", category: "Consumables", description: "Disposable syringe with needle.", supplier: "Surgicare Supplies", quantity: 55, reorderLevel: 12, unit: "Box", unitPrice: 380 },
  { name: "IV Cannula 20G (Box of 50)", category: "Consumables", description: "Peripheral IV catheter, 20 gauge.", supplier: "Surgicare Supplies", quantity: 9, reorderLevel: 12, unit: "Box", unitPrice: 720 },
  { name: "Normal Saline 500 ml", category: "IV Fluids", description: "0.9% sodium chloride IV solution.", supplier: "Kaycee Pharma", quantity: 120, reorderLevel: 40, unit: "Bottle", unitPrice: 48 },
  { name: "Ringer Lactate 500 ml", category: "IV Fluids", description: "Compound sodium lactate IV solution.", supplier: "Kaycee Pharma", quantity: 32, reorderLevel: 30, unit: "Bottle", unitPrice: 55 },
  { name: "IV Giving Set", category: "Consumables", description: "Sterile infusion set with roller clamp.", supplier: "Surgicare Supplies", quantity: 70, reorderLevel: 25, unit: "Piece", unitPrice: 42 },
  { name: "Sterile Gauze Roll 10 cm", category: "Dressings", description: "Absorbent cotton gauze, sterile.", supplier: "Hindustan Surgical", quantity: 85, reorderLevel: 30, unit: "Roll", unitPrice: 28 },
  { name: "Adhesive Tape 1 inch", category: "Dressings", description: "Zinc oxide surgical tape.", supplier: "Hindustan Surgical", quantity: 5, reorderLevel: 15, unit: "Roll", unitPrice: 35 },
  { name: "Cotton Wool 500 g", category: "Dressings", description: "Absorbent cotton wool, packed.", supplier: "Medline India", quantity: 26, reorderLevel: 10, unit: "Pack", unitPrice: 190 },
  { name: "Disposable Bedsheet", category: "Patient Supplies", description: "Non-woven disposable bed sheet.", supplier: "Surgicare Supplies", quantity: 90, reorderLevel: 30, unit: "Piece", unitPrice: 65 },
  { name: "Urine Container 100 ml", category: "Lab Supplies", description: "Sterile specimen container.", supplier: "Biomed Traders", quantity: 150, reorderLevel: 50, unit: "Piece", unitPrice: 22 },
  { name: "Blood Collection Tube (EDTA)", category: "Lab Supplies", description: "Purple top EDTA tube 2 ml.", supplier: "Biomed Traders", quantity: 40, reorderLevel: 60, unit: "Piece", unitPrice: 18 },
  { name: "X-Ray Film 14x17", category: "Imaging Supplies", description: "Blue base X-ray film.", supplier: "Biomed Traders", quantity: 0, reorderLevel: 20, unit: "Sheet", unitPrice: 95 },
  { name: "Hand Sanitizer 500 ml", category: "Hygiene", description: "70% ethanol-based hand rub.", supplier: "Medline India", quantity: 0, reorderLevel: 12, unit: "Bottle", unitPrice: 210 },
];

export interface LabCatalogEntry {
  testName: string;
  category: string;
}

export const LAB_CATALOG: LabCatalogEntry[] = [
  { testName: "Complete Blood Count (CBC)", category: "Hematology" },
  { testName: "Blood Glucose Fasting", category: "Biochemistry" },
  { testName: "HbA1c", category: "Biochemistry" },
  { testName: "Lipid Profile", category: "Biochemistry" },
  { testName: "Liver Function Test (LFT)", category: "Biochemistry" },
  { testName: "Kidney Function Test (KFT)", category: "Biochemistry" },
  { testName: "Thyroid Profile (TSH, T3, T4)", category: "Endocrinology" },
  { testName: "Urine Routine & Microscopy", category: "Urinalysis" },
  { testName: "Electrocardiogram (ECG)", category: "Cardiology" },
  { testName: "Chest X-Ray (PA view)", category: "Radiology" },
  { testName: "CRP (Quantitative)", category: "Immunology" },
  { testName: "Procalcitonin", category: "Immunology" },
];

export const LAB_RESULTS = [
  "Within normal limits.",
  "Mildly elevated — clinical correlation advised.",
  "Borderline value; repeat after 2 weeks.",
  "Negative — no abnormality detected.",
  "Slight deviation from reference range; review with treating doctor.",
];

export interface EmergencyScenarioSeed {
  chiefComplaint: string;
  triageLevel: number;
  diagnosis: string;
  treatment: string;
}

export const EMERGENCY_SCENARIOS: EmergencyScenarioSeed[] = [
  { chiefComplaint: "Road traffic accident with head injury", triageLevel: 2, diagnosis: "Closed head injury with mild concussion", treatment: "CT head, observation, IV analgesics" },
  { chiefComplaint: "Acute chest pain radiating to left arm", triageLevel: 1, diagnosis: "Suspected acute coronary syndrome", treatment: "ECG, Troponin, dual antiplatelet therapy, monitored bed" },
  { chiefComplaint: "Severe asthma exacerbation", triageLevel: 2, diagnosis: "Acute severe asthma", treatment: "Nebulization, IV steroids, SpO2 monitoring" },
  { chiefComplaint: "High-grade fever with rigors", triageLevel: 3, diagnosis: "Febrile illness — dengue screening", treatment: "CBC, NS1 antigen, antipyretics, IV fluids" },
  { chiefComplaint: "Fall from height, suspected fracture", triageLevel: 3, diagnosis: "Distal radius fracture", treatment: "X-ray, immobilization, analgesia" },
  { chiefComplaint: "Acute abdominal pain", triageLevel: 2, diagnosis: "Acute appendicitis suspected", treatment: "USG abdomen, surgical consult, NPO" },
  { chiefComplaint: "Pediatric generalized seizure", triageLevel: 2, diagnosis: "Febrile seizure", treatment: "Antipyretics, IV lorazepam, monitoring" },
  { chiefComplaint: "Deep cut on forearm with bleeding", triageLevel: 4, diagnosis: "Laceration wound", treatment: "Wound irrigation, tetanus prophylaxis, suturing" },
];

export interface SurgeryCatalogSeed {
  procedureName: string;
  procedureType: string;
  department: string;
  estimatedDuration: number;
  anesthesiaType: string;
  /** Staff specialization of the operating surgeon. */
  surgeonSpecialization: string;
}

export const SURGERY_CATALOG: SurgeryCatalogSeed[] = [
  { procedureName: "Coronary Artery Bypass Grafting", procedureType: "Cardiac", department: "Cardiology", estimatedDuration: 240, anesthesiaType: "General", surgeonSpecialization: "Interventional Cardiology" },
  { procedureName: "Percutaneous Coronary Angioplasty with Stenting", procedureType: "Cardiac", department: "Cardiology", estimatedDuration: 90, anesthesiaType: "Local", surgeonSpecialization: "Interventional Cardiology" },
  { procedureName: "Total Knee Replacement", procedureType: "Orthopedic", department: "Orthopedics", estimatedDuration: 150, anesthesiaType: "General", surgeonSpecialization: "Joint Replacement" },
  { procedureName: "Hip Hemiarthroplasty", procedureType: "Orthopedic", department: "Orthopedics", estimatedDuration: 120, anesthesiaType: "Regional", surgeonSpecialization: "Joint Replacement" },
  { procedureName: "Laparoscopic Cholecystectomy", procedureType: "General", department: "General Medicine", estimatedDuration: 75, anesthesiaType: "General", surgeonSpecialization: "Internal Medicine" },
  { procedureName: "Craniotomy for Chronic Subdural Hematoma", procedureType: "Neurological", department: "Neurology", estimatedDuration: 180, anesthesiaType: "General", surgeonSpecialization: "Stroke Medicine" },
  { procedureName: "Appendectomy (Open)", procedureType: "General", department: "General Medicine", estimatedDuration: 60, anesthesiaType: "General", surgeonSpecialization: "Internal Medicine" },
  { procedureName: "Hydrocele Repair", procedureType: "General", department: "Pediatrics", estimatedDuration: 60, anesthesiaType: "General", surgeonSpecialization: "Pediatric Pulmonology" },
  { procedureName: "Debridement and Skin Grafting", procedureType: "Plastic", department: "Emergency", estimatedDuration: 100, anesthesiaType: "General", surgeonSpecialization: "Emergency Medicine" },
  { procedureName: "Intracranial Aneurysm Clipping", procedureType: "Neurological", department: "Neurology", estimatedDuration: 300, anesthesiaType: "General", surgeonSpecialization: "Stroke Medicine" },
];

export interface NotificationSeed {
  title: string;
  message: string;
  type: string;
  action?: string;
  /** Recipient role: which demo account receives it. */
  recipient: "admin" | "doctor" | "nurse" | "reception" | "pharmacy";
}

export const NOTIFICATION_SEEDS: NotificationSeed[] = [
  { title: "Welcome to MedCore", message: "Demo environment ready. Review the dashboard for today's hospital operations.", type: "SYSTEM", action: "/", recipient: "admin" },
  { title: "Monthly audit ready", message: "The October audit log summary is available for review.", type: "SYSTEM", action: "/security", recipient: "admin" },
  { title: "New patient admitted", message: "A new patient has been admitted to Cardiology. Please verify the record.", type: "PATIENT", action: "/patients", recipient: "admin" },
  { title: "Invoice generated", message: "A new invoice was generated for an inpatient stay. Review pending payments.", type: "BILLING", action: "/billing", recipient: "admin" },
  { title: "Low stock alert", message: "Blood Collection Tube (EDTA) is below reorder level. Raise a purchase request.", type: "SYSTEM", action: "/inventory", recipient: "admin" },
  { title: "Password policy updated", message: "Security settings were updated by the administrator.", type: "SECURITY", action: "/security", recipient: "admin" },
  { title: "Today's OPD schedule", message: "You have consultations scheduled today. Please review the appointment list.", type: "APPOINTMENT", action: "/appointments", recipient: "doctor" },
  { title: "Lab results ready", message: "Results for a patient under your care are now available in Laboratory.", type: "SYSTEM", action: "/laboratory", recipient: "doctor" },
  { title: "Patient admitted", message: "Patient admitted under your department. Review the admission notes.", type: "PATIENT", action: "/patients", recipient: "doctor" },
  { title: "Follow-up due", message: "A patient from last week is due for a follow-up consultation.", type: "APPOINTMENT", action: "/appointments", recipient: "doctor" },
  { title: "Ward round reminder", message: "Morning ward round starts at 08:30. Check assigned beds.", type: "SYSTEM", action: "/beds", recipient: "nurse" },
  { title: "Bed released", message: "A bed in your department is now available for assignment.", type: "PATIENT", action: "/beds", recipient: "nurse" },
  { title: "Vitals pending", message: "Scheduled vitals recording is pending for two patients.", type: "PATIENT", action: "/nursing", recipient: "nurse" },
  { title: "New appointment booked", message: "A walk-in appointment was booked for today. Confirm the slot.", type: "APPOINTMENT", action: "/appointments", recipient: "reception" },
  { title: "Discharge paperwork", message: "A discharge summary needs front-desk verification.", type: "PATIENT", action: "/records", recipient: "reception" },
  { title: "Insurance details pending", message: "A newly registered patient has not provided insurance details.", type: "BILLING", action: "/insurance", recipient: "reception" },
  { title: "Prescription queue", message: "New prescriptions are waiting in the dispensing queue.", type: "SYSTEM", action: "/pharmacy", recipient: "pharmacy" },
  { title: "Low stock alert", message: "IV Cannula 20G is below reorder level. Restock from central store.", type: "SYSTEM", action: "/inventory", recipient: "pharmacy" },
  { title: "Medicine expiry notice", message: "Batch of Mixtard 30/70 expires within 90 days. Verify stock rotation.", type: "SYSTEM", action: "/pharmacy", recipient: "pharmacy" },
  { title: "Dispense completed", message: "A prescription was marked as dispensed for an inpatient.", type: "PATIENT", action: "/pharmacy", recipient: "pharmacy" },
  { title: "Weekly operations review", message: "Weekly occupancy and billing summary is ready for the administrator.", type: "SYSTEM", action: "/reports", recipient: "admin" },
  { title: "Appointment cancelled", message: "A patient cancelled tomorrow's appointment. Slot reopened.", type: "APPOINTMENT", action: "/appointments", recipient: "reception" },
  { title: "Critical patient alert", message: "A patient in your department is marked Critical. Prioritize review.", type: "PATIENT", action: "/patients", recipient: "doctor" },
  { title: "Stock received", message: "Central store delivered fresh consumables to the pharmacy.", type: "SYSTEM", action: "/inventory", recipient: "pharmacy" },
];

export const APPOINTMENT_REASONS = [
  "Review of ongoing treatment",
  "New symptoms — consultation requested by GP",
  "Post-operative follow-up",
  "Routine health check-up",
  "Chronic disease monitoring",
  "Test results discussion",
  "Medication review",
  "Pre-surgical clearance",
];

export const INVOICE_DESCRIPTIONS = [
  "Consultation and diagnostics",
  "Inpatient room charges (2 days)",
  "Day-care procedure package",
  "Emergency department charges",
  "Imaging and laboratory tests",
  "Specialist consultation plus ECG",
  "Surgery package — room and consumables",
  "Pharmacy charges (discharge medications)",
];

import type { Role } from "@/types/auth";
import bcrypt from "bcryptjs";

export interface SeedUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  department: string;
  avatar?: string;
}

// IMPORTANT: These are temporary development credentials.
// They will be replaced by a real database in Phase 3+.
// NEVER use these in production.
const SEED_USERS: SeedUser[] = [
  {
    id: "usr_001",
    email: "admin@medcore.com",
    password: "", // Will be hashed
    name: "Dr. Sarah Patel",
    role: "ADMIN",
    department: "Administration",
    avatar: "SP",
  },
  {
    id: "usr_002",
    email: "doctor@medcore.com",
    password: "",
    name: "Dr. James Wilson",
    role: "DOCTOR",
    department: "Cardiology",
    avatar: "JW",
  },
  {
    id: "usr_003",
    email: "nurse@medcore.com",
    password: "",
    name: "Nurse Emily Chen",
    role: "NURSE",
    department: "Emergency",
    avatar: "EC",
  },
  {
    id: "usr_004",
    email: "reception@medcore.com",
    password: "",
    name: "Maria Garcia",
    role: "RECEPTIONIST",
    department: "Front Desk",
    avatar: "MG",
  },
  {
    id: "usr_005",
    email: "pharmacy@medcore.com",
    password: "",
    name: "Pharm. David Kim",
    role: "PHARMACIST",
    department: "Pharmacy",
    avatar: "DK",
  },
];

let _hashedUsers: SeedUser[] | null = null;

export async function getSeedUsers(): Promise<SeedUser[]> {
  if (_hashedUsers) return _hashedUsers;

  const defaultPassword = await bcrypt.hash("medcore123", 10);
  _hashedUsers = SEED_USERS.map((u) => ({
    ...u,
    password: defaultPassword,
  }));
  return _hashedUsers;
}

export async function findUserByEmail(
  email: string,
): Promise<SeedUser | undefined> {
  const users = await getSeedUsers();
  return users.find((u) => u.email === email);
}

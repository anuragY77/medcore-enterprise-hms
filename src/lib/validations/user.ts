import { z } from "zod";
import { ROLES } from "@/types/auth";

const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]];

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email address").max(200),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
  role: z.enum(ROLE_VALUES, { message: "Invalid role" }),
  department: z.string().min(1, "Department is required").max(100),
  avatar: z.string().max(10).optional().nullable(),
});

export type CreateUserData = z.infer<typeof createUserSchema>;

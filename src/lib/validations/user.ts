import "@/lib/zod-csp";

import { z } from "zod";
import { ROLES } from "@/types/auth";

const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]];

// Phase 25: bcrypt silently truncates input at 72 BYTES (empirically
// confirmed against the installed bcryptjs: the first 72 bytes of an
// 80-byte password verify against its hash, for ASCII, 2-byte and 3-byte
// UTF-8 alike). The zod max(200) below counts CHARACTERS, so up to 800
// bytes could be accepted while only 72 were ever enforced — a policy
// mismatch that silently shrinks the effective password. Reject over-long
// input at creation instead (existing hashes are unaffected: bcrypt
// re-truncates identically on every compare, so already-created long
// passwords still sign in).
const PASSWORD_MAX_BYTES = 72;
const utf8 = new TextEncoder();
const passwordByteLength = (value: string): number => utf8.encode(value).length;

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email address").max(200),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(200)
    .refine((value) => passwordByteLength(value) <= PASSWORD_MAX_BYTES, {
      message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes (bcrypt truncates beyond that)`,
    }),
  role: z.enum(ROLE_VALUES, { message: "Invalid role" }),
  department: z.string().min(1, "Department is required").max(100),
  avatar: z.string().max(10).optional().nullable(),
});

export type CreateUserData = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).optional(),
  email: z.string().email("Invalid email address").max(200).optional(),
  role: z.enum(ROLE_VALUES, { message: "Invalid role" }).optional(),
  department: z.string().min(1, "Department is required").max(100).optional(),
  avatar: z.string().max(10).optional().nullable(),
});

export type UpdateUserData = z.infer<typeof updateUserSchema>;

export const userIdSchema = z.string().uuid({ message: "Invalid user ID" });

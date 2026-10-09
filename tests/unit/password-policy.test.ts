// Phase 25 §4: password policy vs bcrypt reality.
//
// bcrypt (via the installed bcryptjs) silently truncates input at 72 BYTES
// — empirically confirmed for ASCII, 2-byte and 3-byte UTF-8 (the first
// 72 bytes of a longer password verify against its hash). createUserSchema
// previously capped CHARACTERS at 200 (i.e. up to 800 bytes), so users
// could "set" passwords whose tail was never stored or checked.
//
// FAIL-ON-REVERT: removing the byte-length refine fails the over-long cases.
// Also covers §15: updateUserSchema must never accept a password field.
import { describe, expect, it } from "vitest";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";

const base = {
  name: "Test User",
  email: "test@medcore.com",
  role: "ADMIN" as const,
  department: "Administration",
};

const withPassword = (password: string) => ({ ...base, password });

const firstIssueMessage = (parse: ReturnType<typeof createUserSchema.safeParse>) =>
  parse.success ? "" : parse.error.issues[0]?.message ?? "";

describe("createUserSchema bcrypt 72-byte password limit (Phase 25 §4)", () => {
  it("accepts the seeded demo password", () => {
    expect(createUserSchema.safeParse(withPassword("medcore123")).success).toBe(true);
  });

  it("accepts a 6-character minimum password", () => {
    expect(createUserSchema.safeParse(withPassword("abc123")).success).toBe(true);
  });

  it("rejects a 5-character password (minimum unchanged)", () => {
    expect(createUserSchema.safeParse(withPassword("abc12")).success).toBe(false);
  });

  it("accepts exactly 72 ASCII bytes", () => {
    expect(createUserSchema.safeParse(withPassword("a".repeat(72))).success).toBe(true);
  });

  it("rejects 73 ASCII bytes even though max(200) characters would allow it", () => {
    const result = createUserSchema.safeParse(withPassword("a".repeat(73)));
    expect(result.success).toBe(false);
    expect(firstIssueMessage(result)).toContain("72 bytes");
  });

  it("accepts exactly 72 bytes of 2-byte UTF-8 (36 x é)", () => {
    expect(
      createUserSchema.safeParse(withPassword("\u00e9".repeat(36))).success
    ).toBe(true);
  });

  it("rejects 40 characters (80 bytes) of 2-byte UTF-8 — byte limit is what counts", () => {
    const result = createUserSchema.safeParse(withPassword("\u00e9".repeat(40)));
    expect(result.success).toBe(false);
    expect(firstIssueMessage(result)).toContain("72 bytes");
  });

  it("accepts exactly 72 bytes of 3-byte UTF-8 (24 x 中)", () => {
    expect(
      createUserSchema.safeParse(withPassword("\u4e2d".repeat(24))).success
    ).toBe(true);
  });

  it("rejects 25 characters (75 bytes) of 3-byte UTF-8", () => {
    const result = createUserSchema.safeParse(withPassword("\u4e2d".repeat(25)));
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema password surface (Phase 25 §5 / §15)", () => {
  it("never carries a password field through a user update", () => {
    const result = updateUserSchema.safeParse({
      name: "Renamed",
      password: "attacker-supplied",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("password" in result.data).toBe(false);
    }
  });
});

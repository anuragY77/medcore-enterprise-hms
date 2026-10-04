import { describe, expect, it } from "vitest";
import {
  BUSINESS_IDS,
  formatBusinessId,
  type BusinessIdKey,
} from "@/lib/business-id";

const KEYS = Object.keys(BUSINESS_IDS) as BusinessIdKey[];

describe("formatBusinessId", () => {
  it("zero-pads three-digit identifiers", () => {
    expect(formatBusinessId("APT", 1)).toBe("APT-001");
    expect(formatBusinessId("STF", 42)).toBe("STF-042");
    expect(formatBusinessId("LAB", 130)).toBe("LAB-130");
    expect(formatBusinessId("MED", 1000)).toBe("MED-1000");
  });

  it("renders patient IDs unpadded above the base", () => {
    expect(formatBusinessId("PT", 10482)).toBe("PT-10482");
    expect(formatBusinessId("PT", 12000)).toBe("PT-12000");
  });
});

describe("business id registry", () => {
  it("covers the 12 previously count-based prefixes", () => {
    expect(KEYS.sort()).toEqual(
      [
        "APT",
        "BED",
        "CLM",
        "DEPT",
        "EMC",
        "INV",
        "ITM",
        "LAB",
        "MED",
        "PT",
        "SRG",
        "STF",
      ].sort()
    );
  });

  it("keeps every entry internally consistent and SQL-safe", () => {
    for (const key of KEYS) {
      const spec = BUSINESS_IDS[key];
      expect(spec.prefix).toBe(key);
      // Static registry identifiers only — they are interpolated via
      // sql.identifier, and this assertion keeps future edits honest.
      expect(spec.table).toMatch(/^[a-z_]+$/);
      expect(spec.column).toMatch(/^[a-z_]+$/);
      expect(spec.pad).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(spec.base)).toBe(true);
      expect(spec.base).toBeGreaterThanOrEqual(1);
    }
  });

  it("matches the historical formats exactly (pad 3, PT base 10482 unpadded)", () => {
    for (const key of KEYS) {
      const spec = BUSINESS_IDS[key];
      if (key === "PT") {
        expect(spec.pad).toBe(0);
        expect(spec.base).toBe(10482);
      } else {
        expect(spec.pad).toBe(3);
        expect(spec.base).toBe(1);
      }
    }
    expect(formatBusinessId("PT", 10482)).toBe("PT-10482");
    expect(formatBusinessId("APT", 1)).toBe("APT-001");
  });
});

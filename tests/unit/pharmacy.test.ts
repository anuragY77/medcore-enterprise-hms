import { describe, expect, it } from "vitest";
import { pickMatchingMedicine } from "@/lib/pharmacy";

type Row = Parameters<typeof pickMatchingMedicine>[0][number];

let seq = 0;
function makeMedicine(overrides: Partial<Row>): Row {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    medicineId: `MED-${String(seq).padStart(4, "0")}`,
    name: `Medicine ${seq}`,
    genericName: null,
    category: "Analgesic",
    manufacturer: null,
    description: null,
    dosage: null,
    unit: "pill",
    stockQuantity: 100,
    reorderLevel: null,
    unitPrice: null,
    expiryDate: null,
    status: "Available",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("pickMatchingMedicine", () => {
  it("returns null for an empty candidate list", () => {
    expect(pickMatchingMedicine([], "Aspirin")).toBeNull();
  });

  it("returns null for empty or whitespace medication names", () => {
    const candidates = [makeMedicine({ name: "Aspirin" })];
    expect(pickMatchingMedicine(candidates, "")).toBeNull();
    expect(pickMatchingMedicine(candidates, "   ")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    const candidates = [makeMedicine({ name: "Aspirin" })];
    expect(pickMatchingMedicine(candidates, "Ibuprofen")).toBeNull();
    expect(pickMatchingMedicine(candidates, "Aspirinn")).toBeNull();
  });

  it("does not match when a generic name exists but differs", () => {
    const candidates = [
      makeMedicine({ name: "Bayer Plus", genericName: "Ibuprofen" }),
    ];
    expect(pickMatchingMedicine(candidates, "Aspirin")).toBeNull();
  });

  it("matches the brand name case-insensitively and with padding", () => {
    const candidates = [makeMedicine({ name: "Aspirin" })];
    expect(pickMatchingMedicine(candidates, "aspirin")?.name).toBe("Aspirin");
    expect(pickMatchingMedicine(candidates, "  ASPIRIN  ")?.name).toBe(
      "Aspirin"
    );
  });

  it("matches by generic name when the brand does not match", () => {
    const candidates = [
      makeMedicine({ name: "Bayer Plus", genericName: "Aspirin" }),
    ];
    expect(pickMatchingMedicine(candidates, "aspirin")?.name).toBe(
      "Bayer Plus"
    );
  });

  it("prefers an exact brand-name match over a generic-name match", () => {
    const genericMatch = makeMedicine({
      name: "Aspirin Compound",
      genericName: "Aspirin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    // genericName present on the brand match too: exercises the ||-short
    // circuit where the name already matches.
    const brandMatch = makeMedicine({
      name: "Aspirin",
      genericName: "Acetylsalicylic acid",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    const result = pickMatchingMedicine(
      [genericMatch, brandMatch],
      "Aspirin"
    );
    expect(result?.name).toBe("Aspirin");
  });

  it("breaks ties within the same tier by oldest createdAt", () => {
    const older = makeMedicine({
      name: "Aspirin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = makeMedicine({
      name: "Aspirin",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });
    expect(pickMatchingMedicine([newer, older], "Aspirin")?.id).toBe(
      older.id
    );
  });

  it("does not throw when genericName is null", () => {
    const candidates = [makeMedicine({ name: "Aspirin", genericName: null })];
    expect(() => pickMatchingMedicine(candidates, "something")).not.toThrow();
    expect(pickMatchingMedicine(candidates, "something")).toBeNull();
  });
});

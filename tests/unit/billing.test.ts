import { describe, expect, it } from "vitest";
import { computeInvoiceTotal, isUniqueViolation, round2 } from "@/lib/billing";

describe("round2", () => {
  it("keeps already-rounded values unchanged", () => {
    expect(round2(10)).toBe(10);
    expect(round2(10.1)).toBe(10.1);
    expect(round2(10.12)).toBe(10.12);
  });

  it("rounds half-up at the cent level", () => {
    expect(round2(10.126)).toBe(10.13);
    expect(round2(10.124)).toBe(10.12);
  });

  it("handles zero and negatives", () => {
    expect(round2(0)).toBe(0);
    expect(round2(-1.239)).toBe(-1.24);
  });

  it("is idempotent", () => {
    const once = round2(33.333333);
    expect(round2(once)).toBe(once);
  });
});

describe("computeInvoiceTotal", () => {
  it("computes subtotal + tax - discount", () => {
    expect(computeInvoiceTotal(100, 10, 5)).toBe(105);
  });

  it("treats missing tax and discount as zero", () => {
    expect(computeInvoiceTotal(100)).toBe(100);
    expect(computeInvoiceTotal(100, undefined, undefined)).toBe(100);
  });

  it("treats explicit null tax and discount as zero", () => {
    expect(computeInvoiceTotal(100, null, null)).toBe(100);
  });

  it("supports tax only and discount only", () => {
    expect(computeInvoiceTotal(50, 5, null)).toBe(55);
    expect(computeInvoiceTotal(50, null, 10)).toBe(40);
  });

  it("handles zero subtotal", () => {
    expect(computeInvoiceTotal(0, 0, 0)).toBe(0);
    expect(computeInvoiceTotal(0, 5, 0)).toBe(5);
  });

  it("rounds the result to two decimals", () => {
    // 0.1 + 0.2-style floating point noise must not leak into the total.
    expect(computeInvoiceTotal(19.99, 1.6, 0)).toBe(21.59);
    expect(computeInvoiceTotal(10.005, 0, 0)).toBe(10.01);
  });

  it("allows a total below zero (no clamping in implementation)", () => {
    // Documented behavior: discount is subtracted without a floor.
    expect(computeInvoiceTotal(10, 0, 30)).toBe(-20);
  });
});

describe("isUniqueViolation", () => {
  it("detects a top-level 23505 code", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects a 23505 code nested under cause", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("rejects other postgres codes", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation({ cause: { code: "23502" } })).toBe(false);
  });

  it("rejects non-errors", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(23505)).toBe(false);
  });
});

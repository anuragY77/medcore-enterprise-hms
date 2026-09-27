export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeInvoiceTotal(
  subtotal: number,
  taxAmount?: number | null,
  discountAmount?: number | null
): number {
  return round2(subtotal + (taxAmount ?? 0) - (discountAmount ?? 0));
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; cause?: { code?: string } };
  return err.code === "23505" || err.cause?.code === "23505";
}

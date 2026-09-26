import { pharmacyMedicines } from "@/lib/db";

type MedicineRow = typeof pharmacyMedicines.$inferSelect;

export function pickMatchingMedicine(
  candidates: MedicineRow[],
  medicationName: string
): MedicineRow | null {
  const target = medicationName.trim().toLowerCase();
  if (!target) return null;

  const matching = candidates.filter(
    (m) =>
      m.name.toLowerCase() === target ||
      (m.genericName != null && m.genericName.toLowerCase() === target)
  );

  if (matching.length === 0) return null;

  matching.sort((a, b) => {
    const aExact = a.name.toLowerCase() === target ? 0 : 1;
    const bExact = b.name.toLowerCase() === target ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return matching[0];
}

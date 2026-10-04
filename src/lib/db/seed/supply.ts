import { inventoryItems, pharmacyMedicines } from "@/lib/db/schema";
import { INVENTORY_ITEMS, MEDICINES } from "./datasets";
import { createRng, deterministicUuid } from "./ids";
import { daysFrom, type SeedContext, type SeedCounts, type Tx } from "./types";

const pad3 = (n: number): string => String(n).padStart(3, "0");

/** 24 pharmacy medicines + 16 inventory items, status-aware and idempotent. */
export async function seedSupply(
  tx: Tx,
  ctx: SeedContext
): Promise<SeedCounts> {
  const rng = createRng(0x519e11);
  const now = ctx.now;

  for (let i = 0; i < MEDICINES.length; i++) {
    const med = MEDICINES[i];
    const status =
      i === MEDICINES.length - 1
        ? "Discontinued"
        : i === MEDICINES.length - 2
          ? "Inactive"
          : "Active";
    await tx
      .insert(pharmacyMedicines)
      .values({
        id: deterministicUuid("medicine", med.name),
        medicineId: `MED-${pad3(i + 1)}`,
        name: med.name,
        genericName: med.genericName,
        category: med.category,
        manufacturer: med.manufacturer,
        description: `${med.genericName} (${med.manufacturer}) — ${med.category} for inpatient and outpatient use.`,
        dosage: med.dosage,
        unit: med.unit,
        stockQuantity: med.stockQuantity,
        reorderLevel: med.reorderLevel,
        unitPrice: med.unitPrice,
        expiryDate: daysFrom(now, med.monthsToExpiry * 30),
        status,
        createdAt: daysFrom(now, -300),
        updatedAt: daysFrom(now, -7),
      })
      .onConflictDoUpdate({
        // Name is the stable natural key (unique) even if medicineIds differ.
        target: pharmacyMedicines.name,
        set: {
          medicineId: `MED-${pad3(i + 1)}`,
          genericName: med.genericName,
          category: med.category,
          manufacturer: med.manufacturer,
          description: `${med.genericName} (${med.manufacturer}) — ${med.category} for inpatient and outpatient use.`,
          dosage: med.dosage,
          unit: med.unit,
          stockQuantity: med.stockQuantity,
          reorderLevel: med.reorderLevel,
          unitPrice: med.unitPrice,
          expiryDate: daysFrom(now, med.monthsToExpiry * 30),
          status,
          updatedAt: new Date(),
        },
      });
  }

  for (let i = 0; i < INVENTORY_ITEMS.length; i++) {
    const item = INVENTORY_ITEMS[i];
    const status =
      item.quantity === 0
        ? "Out of Stock"
        : item.quantity <= item.reorderLevel
          ? "Low Stock"
          : "In Stock";
    await tx
      .insert(inventoryItems)
      .values({
        id: deterministicUuid("inventory-item", `ITM-${pad3(i + 1)}`),
        itemId: `ITM-${pad3(i + 1)}`,
        name: item.name,
        category: item.category,
        description: item.description,
        supplier: item.supplier,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        unit: item.unit,
        unitPrice: item.unitPrice,
        location: i % 4 === 0 ? "Pharmacy Store" : i % 4 === 1 ? "Main Lobby" : "Store A",
        status,
        lastRestockedAt: daysFrom(now, -(5 + Math.floor(rng() * 35))),
        createdAt: daysFrom(now, -300),
        updatedAt: daysFrom(now, -7),
      })
      .onConflictDoUpdate({
        target: inventoryItems.itemId,
        set: {
          name: item.name,
          category: item.category,
          description: item.description,
          supplier: item.supplier,
          quantity: item.quantity,
          reorderLevel: item.reorderLevel,
          unit: item.unit,
          unitPrice: item.unitPrice,
          location: i % 4 === 0 ? "Pharmacy Store" : i % 4 === 1 ? "Main Lobby" : "Store A",
          status,
          lastRestockedAt: daysFrom(now, -(5 + Math.floor(rng() * 35))),
          updatedAt: new Date(),
        },
      });
  }

  return {
    pharmacyMedicines: MEDICINES.length,
    inventoryItems: INVENTORY_ITEMS.length,
  };
}

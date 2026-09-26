"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Send, AlertTriangle } from "lucide-react";

interface QueueMedicine {
  id: string;
  medicineId: string;
  name: string;
  genericName: string | null;
  unit: string;
  stockQuantity: number;
  unitPrice: number | null;
  expiryDate: string | null;
  status: string;
}

interface QueuePrescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  instructions: string | null;
  prescribedBy: string;
  status: string;
  createdAt: string;
}

interface QueuePatient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
}

export interface PrescriptionQueueRow {
  prescription: QueuePrescription;
  patient: QueuePatient;
  medicine: QueueMedicine | null;
}

interface PrescriptionQueueProps {
  onDispensed?: () => void;
}

function isExpired(medicine: QueueMedicine): boolean {
  if (!medicine.expiryDate) return false;
  return new Date(medicine.expiryDate) < new Date();
}

export function PrescriptionQueue({ onDispensed }: PrescriptionQueueProps) {
  const router = useRouter();
  const [rows, setRows] = useState<PrescriptionQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [dispensingId, setDispensingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/pharmacy/prescriptions?status=Active&pageSize=50");
      if (res.status === 401) {
        router.push("/login?callbackUrl=/pharmacy");
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load prescriptions");
      }
      const data = await res.json();
      setRows(data.data);
      setQuantities((prev) => {
        const next = { ...prev };
        for (const row of data.data as PrescriptionQueueRow[]) {
          if (next[row.prescription.id] === undefined) {
            next[row.prescription.id] = "1";
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const load = async () => {
      await fetchQueue();
    };
    load();
  }, [fetchQueue]);

  async function handleDispense(prescriptionId: string) {
    if (dispensingId) return;

    const row = rows.find((r) => r.prescription.id === prescriptionId);
    const raw = quantities[prescriptionId] ?? "1";
    const quantity = Number(raw);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be a whole number of at least 1.");
      return;
    }
    if (row?.medicine && quantity > row.medicine.stockQuantity) {
      setError(`Only ${row.medicine.stockQuantity} ${row.medicine.unit} available in stock.`);
      return;
    }

    setDispensingId(prescriptionId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(
        `/api/pharmacy/prescriptions/${prescriptionId}/dispense`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        }
      );

      if (res.status === 201) {
        const data = await res.json();
        setSuccess(
          `Dispensed ${quantity} ${data.medicine.unit} — ${data.medicine.stockQuantity} ${data.medicine.unit} remaining in stock.`
        );
        await fetchQueue();
        onDispensed?.();
        return;
      }
      if (res.status === 401) {
        router.push("/login?callbackUrl=/pharmacy");
        return;
      }
      if (res.status === 403) {
        setError("You do not have permission to dispense medicines.");
        return;
      }
      if (res.status === 404) {
        setError("Prescription not found.");
        await fetchQueue();
        return;
      }
      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Prescription cannot be dispensed.");
        return;
      }
      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        setError(data?.details?.quantity?.[0] ?? "Invalid dispense request.");
        return;
      }
      if (res.status >= 500) {
        setError("Something went wrong. Please try again.");
        return;
      }
      setError("Failed to dispense prescription.");
    } catch {
      setError("Failed to dispense prescription.");
    } finally {
      setDispensingId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border/50 shadow-sm py-8 text-center text-sm text-muted-foreground">
        Loading prescriptions...
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-card rounded-lg border border-border/50 shadow-sm py-8 text-center text-sm text-muted-foreground">
          No active prescriptions awaiting dispensing.
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Patient
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Medication
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Medicine Stock
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Quantity
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const busy = dispensingId === row.prescription.id;
                  const anyBusy = dispensingId !== null;
                  const expired = row.medicine ? isExpired(row.medicine) : false;
                  return (
                    <tr
                      key={row.prescription.id}
                      className="border-b border-border/40 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {row.patient.firstName} {row.patient.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.patient.patientId}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {row.prescription.medicationName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.prescription.dosage} · {row.prescription.frequency}
                          {row.prescription.duration
                            ? ` · ${row.prescription.duration}`
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.prescription.prescribedBy}
                        </p>
                        {row.prescription.instructions && (
                          <p className="mt-1 text-xs text-muted-foreground italic">
                            {row.prescription.instructions}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.medicine ? (
                          <div>
                            <p className="text-foreground">{row.medicine.name}</p>
                            <p
                              className={
                                row.medicine.stockQuantity > 0 && !expired
                                  ? "text-xs text-muted-foreground"
                                  : "text-xs text-red-600"
                              }
                            >
                              {row.medicine.stockQuantity} {row.medicine.unit} available
                            </p>
                            {expired && (
                              <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                                Expired
                              </span>
                            )}
                            {!expired && row.medicine.expiryDate && (
                              <p className="text-xs text-muted-foreground">
                                Exp:{" "}
                                {new Date(row.medicine.expiryDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                            Not in pharmacy stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={quantities[row.prescription.id] ?? "1"}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [row.prescription.id]: e.target.value,
                            }))
                          }
                          disabled={!row.medicine || anyBusy}
                          className="w-20 px-2 py-1.5 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDispense(row.prescription.id)}
                          disabled={!row.medicine || anyBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {busy ? "Dispensing..." : "Dispense"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-3 text-right">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSuccess(null);
            fetchQueue();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
    </div>
  );
}

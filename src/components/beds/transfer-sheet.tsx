"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type AvailableBed = {
  id: string;
  bedId: string;
  roomNumber: string;
  department: string;
  ward: string | null;
  type: string;
};

interface TransferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientNumber: string;
  sourceBedId: string;
  sourceBedCode: string;
  onSuccess?: () => void;
}

export function TransferSheet({
  open,
  onOpenChange,
  patientId,
  patientNumber,
  sourceBedId,
  sourceBedCode,
  onSuccess,
}: TransferSheetProps) {
  const router = useRouter();
  const [beds, setBeds] = useState<AvailableBed[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ok" | "failed">("loading");
  const [selectedBedId, setSelectedBedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/beds?status=Available&pageSize=100`);
        if (cancelled) return;
        if (res.status === 401) {
          router.push(`/login?callbackUrl=/patients/${patientId}`);
          return;
        }
        if (!res.ok) {
          setLoadStatus("failed");
          return;
        }
        const payload = await res.json();
        if (cancelled) return;
        const rows = Array.isArray(payload?.data) ? (payload.data as AvailableBed[]) : [];
        setBeds(rows.filter((b) => b.id !== sourceBedId));
        setLoadStatus("ok");
      } catch {
        if (!cancelled) setLoadStatus("failed");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, reloadKey, patientId, router, sourceBedId]);

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedBedId("");
      setSubmitError(null);
      setSuccess(false);
      setLoadStatus("loading");
      setBeds([]);
    }
    onOpenChange(nextOpen);
  };

  const retry = () => {
    setLoadStatus("loading");
    setReloadKey((k) => k + 1);
  };

  const submit = async () => {
    if (!selectedBedId || busy) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedId: selectedBedId }),
      });
      if (res.status === 401) {
        router.push(`/login?callbackUrl=/patients/${patientId}`);
        return;
      }
      const payload = await res.json().catch(() => null);
      if (res.status === 403) {
        setSubmitError("You do not have permission to transfer this patient.");
        return;
      }
      if (!res.ok) {
        setSubmitError(
          typeof payload?.error === "string" ? payload.error : "Failed to transfer patient"
        );
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to transfer patient");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Transfer Patient</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {success ? (
            <>
              <p className="text-sm text-emerald-700">
                {patientNumber} has been transferred from {sourceBedCode} to the destination bed.
              </p>
              <button
                onClick={() => close(false)}
                className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                <span className="text-muted-foreground">Current bed</span>
                <span className="text-foreground font-medium">{sourceBedCode}</span>
              </div>
              <div className="space-y-1">
                <label htmlFor="transfer-destination" className="text-sm font-medium text-foreground">
                  Destination bed
                </label>
                {loadStatus === "loading" ? (
                  <p className="text-sm text-muted-foreground">Loading available beds...</p>
                ) : loadStatus === "failed" ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Unable to load available beds.</p>
                    <button
                      onClick={retry}
                      className="px-3 py-1.5 rounded-md border border-border/50 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : beds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No available beds.</p>
                ) : (
                  <select
                    id="transfer-destination"
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select a destination bed...</option>
                    {beds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bedId} — Room {b.roomNumber}, {b.department}
                        {b.ward ? ` (${b.ward})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The current bed is released and the destination bed is occupied in a single
                server-side step.
              </p>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <button
                onClick={submit}
                disabled={!selectedBedId || busy}
                className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Transferring..." : "Transfer Patient"}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

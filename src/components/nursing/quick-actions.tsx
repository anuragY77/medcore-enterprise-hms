"use client";

import { useState } from "react";
import { Activity, Pill, ArrowRightLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VitalsForm } from "@/components/clinical/vitals-form";
import type { WardPatient } from "./ward-patient-table";

interface QuickActionsProps {
  patients: WardPatient[];
}

export function QuickActions({ patients }: QuickActionsProps) {
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [medicationOpen, setMedicationOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const handleRecordVitals = () => {
    if (patients.length > 0) {
      setSelectedPatientId(patients[0].id);
      setVitalsOpen(true);
    }
  };

  const handleVitalsSuccess = () => {
    setVitalsOpen(false);
    setSelectedPatientId("");
    window.location.reload();
  };

  return (
    <>
      <div className="bg-card rounded-lg border border-border/50 shadow-sm">
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
        </div>
        <div className="p-4 space-y-2">
          <button
            onClick={handleRecordVitals}
            disabled={patients.length === 0}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Activity className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Record Vitals</p>
              <p className="text-xs text-muted-foreground">Log patient vital signs</p>
            </div>
          </button>
          <button
            onClick={() => setMedicationOpen(true)}
            disabled={patients.length === 0}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Pill className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Administer Medication</p>
              <p className="text-xs text-muted-foreground">View and manage prescriptions</p>
            </div>
          </button>
          <button
            onClick={() => setTransferOpen(true)}
            disabled={patients.length === 0}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Request Transfer</p>
              <p className="text-xs text-muted-foreground">Initiate patient ward transfer</p>
            </div>
          </button>
        </div>
      </div>

      <Sheet open={vitalsOpen} onOpenChange={setVitalsOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Record Vitals</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedPatientId && (
              <VitalsForm patientId={selectedPatientId} onSuccess={handleVitalsSuccess} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={medicationOpen} onOpenChange={setMedicationOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Administer Medication</SheetTitle>
          </SheetHeader>
          <div className="mt-4 p-4">
            <p className="text-sm text-muted-foreground">
              Medication administration is managed through the existing Pharmacy module.
              Active prescriptions for ward patients are displayed in the Task Queue.
            </p>
            <a
              href="/pharmacy"
              className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
            >
              Go to Pharmacy →
            </a>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={transferOpen} onOpenChange={setTransferOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Request Transfer</SheetTitle>
          </SheetHeader>
          <div className="mt-4 p-4">
            <p className="text-sm text-muted-foreground">
              Patient transfers are coordinated through bed management.
              Update bed assignments in the Beds & Rooms module.
            </p>
            <a
              href="/beds"
              className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
            >
              Go to Beds & Rooms →
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

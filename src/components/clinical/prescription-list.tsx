"use client";

import { useState, useEffect } from "react";
import { Pill, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  instructions: string | null;
  prescribedBy: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

interface PrescriptionListProps {
  patientId: string;
  statusFilter?: string;
}

export function PrescriptionList({ patientId, statusFilter = "All" }: PrescriptionListProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrescriptions() {
      try {
        const params = statusFilter !== "All" ? `?status=${statusFilter}` : "";
        const res = await fetch(`/api/patients/${patientId}/prescriptions${params}`);
        if (res.ok) {
          const data = await res.json();
          setPrescriptions(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch prescriptions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPrescriptions();
  }, [patientId, statusFilter]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          Loading prescriptions...
        </CardContent>
      </Card>
    );
  }

  if (prescriptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          No prescriptions found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {prescriptions.map((prescription) => (
        <Card key={prescription.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Pill className="h-4 w-4 text-emerald-600" />
                {prescription.medicationName}
              </CardTitle>
              <Badge
                variant={prescription.status === "Active" ? "default" : "secondary"}
                className={
                  prescription.status === "Active"
                    ? "bg-emerald-100 text-emerald-800"
                    : prescription.status === "Completed"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-amber-100 text-amber-800"
                }
              >
                {prescription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium text-slate-700">Dosage: </span>
                <span className="text-slate-600">{prescription.dosage}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Frequency: </span>
                <span className="text-slate-600">{prescription.frequency}</span>
              </div>
              {prescription.duration && (
                <div>
                  <span className="font-medium text-slate-700">Duration: </span>
                  <span className="text-slate-600">{prescription.duration}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-600">
                <User className="h-4 w-4" />
                <span>{prescription.prescribedBy}</span>
              </div>
            </div>
            {prescription.instructions && (
              <div className="mt-2 rounded-md bg-slate-50 p-2 text-sm text-slate-600">
                {prescription.instructions}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

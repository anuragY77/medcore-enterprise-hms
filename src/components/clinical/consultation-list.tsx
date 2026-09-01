"use client";

import { useState, useEffect } from "react";
import { Calendar, FileText, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Consultation {
  id: string;
  doctorName: string;
  chiefComplaint: string;
  diagnosis: string;
  treatmentPlan: string | null;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
}

interface ConsultationListProps {
  patientId: string;
}

export function ConsultationList({ patientId }: ConsultationListProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConsultations() {
      try {
        const res = await fetch(`/api/patients/${patientId}/consultations`);
        if (res.ok) {
          const data = await res.json();
          setConsultations(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch consultations:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchConsultations();
  }, [patientId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          Loading consultations...
        </CardContent>
      </Card>
    );
  }

  if (consultations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          No consultations found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {consultations.map((consultation) => (
        <Card key={consultation.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {consultation.chiefComplaint}
              </CardTitle>
              <Badge variant="secondary">
                {new Date(consultation.createdAt).toLocaleDateString()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="h-4 w-4" />
                <span>{consultation.doctorName}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Diagnosis: </span>
                <span className="text-slate-600">{consultation.diagnosis}</span>
              </div>
              {consultation.treatmentPlan && (
                <div>
                  <span className="font-medium text-slate-700">Treatment: </span>
                  <span className="text-slate-600">{consultation.treatmentPlan}</span>
                </div>
              )}
              {consultation.followUpDate && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4" />
                  <span>Follow-up: {new Date(consultation.followUpDate).toLocaleDateString()}</span>
                </div>
              )}
              {consultation.notes && (
                <div className="mt-2 rounded-md bg-slate-50 p-2 text-slate-600">
                  {consultation.notes}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

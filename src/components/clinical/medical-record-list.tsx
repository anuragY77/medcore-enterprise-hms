"use client";

import { useState, useEffect } from "react";
import { FileText, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MedicalRecord {
  id: string;
  recordType: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  recordedBy: string;
  recordDate: string;
  createdAt: string;
}

interface MedicalRecordListProps {
  patientId: string;
  recordTypeFilter?: string;
}

const recordTypeColors: Record<string, string> = {
  Clinical: "bg-blue-100 text-blue-800",
  Lab: "bg-purple-100 text-purple-800",
  Imaging: "bg-amber-100 text-amber-800",
  Administrative: "bg-slate-100 text-slate-600",
  Discharge: "bg-emerald-100 text-emerald-800",
};

export function MedicalRecordList({ patientId, recordTypeFilter = "All" }: MedicalRecordListProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecords() {
      try {
        const params = recordTypeFilter !== "All" ? `?recordType=${recordTypeFilter}` : "";
        const res = await fetch(`/api/patients/${patientId}/records${params}`);
        if (res.ok) {
          const data = await res.json();
          setRecords(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch records:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, [patientId, recordTypeFilter]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          Loading records...
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          No medical records found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <Card key={record.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-slate-500" />
                {record.title}
              </CardTitle>
              <Badge
                variant="secondary"
                className={recordTypeColors[record.recordType] || "bg-slate-100 text-slate-600"}
              >
                {record.recordType}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="h-4 w-4" />
                <span>{record.recordedBy}</span>
                <span className="text-slate-400">|</span>
                <span>{new Date(record.recordDate).toLocaleDateString()}</span>
              </div>
              {record.description && (
                <div className="mt-2 rounded-md bg-slate-50 p-2 text-slate-600">
                  {record.description}
                </div>
              )}
              {record.fileUrl && (
                <a
                  href={record.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-emerald-600 hover:underline"
                >
                  View attached file
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

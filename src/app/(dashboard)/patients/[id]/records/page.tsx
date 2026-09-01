"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { MedicalRecordList, MedicalRecordForm } from "@/components/clinical";

export default function RecordsPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [refreshKey, setRefreshKey] = useState(0);
  const [recordTypeFilter, setRecordTypeFilter] = useState("All");

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: patientId, href: `/patients/${patientId}` },
          { label: "Records" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Medical Records
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clinical document management
        </p>
      </div>
      <div className="mb-4 flex gap-2">
        {["All", "Clinical", "Lab", "Imaging", "Administrative", "Discharge"].map(
          (type) => (
            <button
              key={type}
              onClick={() => setRecordTypeFilter(type)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                recordTypeFilter === type
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {type}
            </button>
          )
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Record History
          </h2>
          <MedicalRecordList
            patientId={patientId}
            recordTypeFilter={recordTypeFilter}
            key={refreshKey}
          />
        </div>
        <div>
          <MedicalRecordForm
            patientId={patientId}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}

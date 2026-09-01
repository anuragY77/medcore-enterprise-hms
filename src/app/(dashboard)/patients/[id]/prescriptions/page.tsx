"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PrescriptionList, PrescriptionForm } from "@/components/clinical";

export default function PrescriptionsPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("All");

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: patientId, href: `/patients/${patientId}` },
          { label: "Prescriptions" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Prescriptions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage patient prescriptions and medication orders
        </p>
      </div>
      <div className="mb-4 flex gap-2">
        {["All", "Active", "Completed", "Discontinued"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === status
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Prescription History
          </h2>
          <PrescriptionList
            patientId={patientId}
            statusFilter={statusFilter}
            key={refreshKey}
          />
        </div>
        <div>
          <PrescriptionForm
            patientId={patientId}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}

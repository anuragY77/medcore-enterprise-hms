"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ConsultationList, ConsultationForm } from "@/components/clinical";

export default function ConsultationPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: patientId, href: `/patients/${patientId}` },
          { label: "Consultations" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Consultations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage clinical consultations
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Consultation History
          </h2>
          <ConsultationList patientId={patientId} key={refreshKey} />
        </div>
        <div>
          <ConsultationForm
            patientId={patientId}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}

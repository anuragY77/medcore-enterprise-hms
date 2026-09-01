"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { AdmissionForm } from "@/components/clinical";

export default function AdmissionPage() {
  const params = useParams();
  const patientId = params.id as string;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: patientId, href: `/patients/${patientId}` },
          { label: "Admission" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Patient Admission
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admit patient to a department
        </p>
      </div>
      <div className="max-w-2xl">
        <AdmissionForm
          patientId={patientId}
          onSuccess={() => {
            window.location.href = `/patients/${patientId}`;
          }}
        />
      </div>
    </div>
  );
}

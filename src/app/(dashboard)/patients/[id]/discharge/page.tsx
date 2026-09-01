"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DischargeForm } from "@/components/clinical";

export default function DischargePage() {
  const params = useParams();
  const patientId = params.id as string;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: patientId, href: `/patients/${patientId}` },
          { label: "Discharge" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Discharge Summary
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Patient discharge documentation
        </p>
      </div>
      <div className="max-w-2xl">
        <DischargeForm
          patientId={patientId}
          onSuccess={() => {
            window.location.href = `/patients/${patientId}`;
          }}
        />
      </div>
    </div>
  );
}

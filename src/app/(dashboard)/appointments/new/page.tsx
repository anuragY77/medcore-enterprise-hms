"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { AppointmentForm } from "@/components/appointments";

export default function NewAppointmentPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Appointments", href: "/appointments" },
          { label: "New Appointment" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          New Appointment
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Schedule a new patient appointment
        </p>
      </div>
      <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
        <AppointmentForm mode="create" />
      </div>
    </div>
  );
}

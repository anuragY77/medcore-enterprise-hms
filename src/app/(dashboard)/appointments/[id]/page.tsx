"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { AppointmentForm } from "@/components/appointments";
import type { Appointment } from "@/components/appointments";

export default function AppointmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");

  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/appointments/${params.id}`);
        if (!res.ok) throw new Error("Failed to fetch appointment");
        const data = await res.json();
        setAppointment(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load appointment");
      } finally {
        setLoading(false);
      }
    };
    fetchAppointment();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      const res = await fetch(`/api/appointments/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete appointment");
      router.push("/appointments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete appointment");
    }
  };

  if (loading) {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Appointments", href: "/appointments" },
            { label: "Loading..." },
          ]}
        />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading appointment...</div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Appointments", href: "/appointments" },
            { label: "Error" },
          ]}
        />
        <div className="text-center py-12 text-destructive text-sm">{error || "Appointment not found"}</div>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Appointments", href: "/appointments" },
            { label: `Edit ${appointment.appointmentId}` },
          ]}
        />
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Edit Appointment {appointment.appointmentId}
          </h1>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
          <AppointmentForm
            initialData={{
              ...appointment,
              date: appointment.date,
            }}
            mode="edit"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Appointments", href: "/appointments" },
          { label: appointment.appointmentId },
        ]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Appointment {appointment.appointmentId}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {appointment.type} with {appointment.doctorName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("edit")}
            className="px-3 py-1.5 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-md border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Appointment ID</h3>
            <p className="text-sm text-foreground font-medium">{appointment.appointmentId}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Status</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                appointment.status === "Scheduled"
                  ? "bg-blue-100 text-blue-800"
                  : appointment.status === "Confirmed"
                  ? "bg-emerald-100 text-emerald-800"
                  : appointment.status === "Completed"
                  ? "bg-slate-100 text-slate-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {appointment.status}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Doctor</h3>
            <p className="text-sm text-foreground">{appointment.doctorName}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Department</h3>
            <p className="text-sm text-foreground">{appointment.department}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Date</h3>
            <p className="text-sm text-foreground">{new Date(appointment.date).toLocaleDateString()}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Time</h3>
            <p className="text-sm text-foreground">{appointment.time}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Type</h3>
            <p className="text-sm text-foreground">{appointment.type}</p>
          </div>
          {appointment.reason && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Reason</h3>
              <p className="text-sm text-foreground">{appointment.reason}</p>
            </div>
          )}
          {appointment.notes && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Notes</h3>
              <p className="text-sm text-foreground">{appointment.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

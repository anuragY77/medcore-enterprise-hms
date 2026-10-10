"use client";

import { useEffect, useState } from "react";
import { Clock, Calendar } from "lucide-react";

interface ScheduleAppointment {
  id: string;
  date: string;
  time: string;
  department: string;
  status: string;
}

interface ScheduleViewProps {
  /** Exact doctorName stored on appointments, e.g. "Dr. Adaeze Okoro". */
  doctorName: string;
}

const WEEKDAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const WEEKDAYS_FROM_DATE = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function weekdayOf(dateIso: string): string {
  return WEEKDAYS_FROM_DATE[new Date(dateIso).getDay()] ?? "";
}

export function ScheduleView({ doctorName }: ScheduleViewProps) {
  const [appointments, setAppointments] = useState<ScheduleAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ doctorName, pageSize: "100" });
        const res = await fetch(`/api/appointments?${params.toString()}`);
        if (!res.ok) {
          throw new Error(
            res.status === 401 || res.status === 403
              ? "You do not have permission to view this schedule."
              : "Failed to load schedule."
          );
        }
        const payload = (await res.json()) as { data?: ScheduleAppointment[] };
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const upcoming = rows.filter(
          (appointment) =>
            appointment.status !== "Cancelled" &&
            new Date(appointment.date) >= startOfToday
        );
        if (!cancelled) setAppointments(upcoming);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load schedule."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [doctorName]);

  const slotsByDay = new Map<string, ScheduleAppointment[]>();
  for (const appointment of appointments) {
    const day = weekdayOf(appointment.date);
    if (!day) continue;
    const slots = slotsByDay.get(day);
    if (slots) slots.push(appointment);
    else slotsByDay.set(day, [appointment]);
  }
  for (const slots of slotsByDay.values()) {
    slots.sort((a, b) => a.time.localeCompare(b.time));
  }

  const daysToShow = WEEKDAY_ORDER.filter((day) => {
    if (slotsByDay.has(day)) return true;
    return day !== "Saturday" && day !== "Sunday";
  });

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground font-headline">
          Upcoming Schedule
        </h3>
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground">Loading schedule...</p>
      )}
      {!loading && error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {!loading && !error && appointments.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No upcoming appointments scheduled.
        </p>
      )}
      {!loading && !error && appointments.length > 0 && (
        <div className="space-y-2">
          {daysToShow.map((day) => {
            const slots = slotsByDay.get(day) ?? [];
            return (
              <div
                key={day}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <span className="text-xs font-medium text-muted-foreground w-20 shrink-0 pt-0.5">
                  {day}
                </span>
                {slots.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">
                    No appointments
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/5 border border-primary/10"
                      >
                        <Clock className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-foreground">
                          {slot.time}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {slot.department}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

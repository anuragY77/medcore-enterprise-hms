"use client";

import { Clock, Calendar } from "lucide-react";

interface ScheduleSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  department: string;
}

const MOCK_SCHEDULE: ScheduleSlot[] = [
  { id: "1", day: "Monday", startTime: "08:00", endTime: "12:00", department: "Cardiology" },
  { id: "2", day: "Monday", startTime: "14:00", endTime: "17:00", department: "Cardiology" },
  { id: "3", day: "Tuesday", startTime: "08:00", endTime: "12:00", department: "Cardiology" },
  { id: "4", day: "Wednesday", startTime: "10:00", endTime: "14:00", department: "Cardiology" },
  { id: "5", day: "Thursday", startTime: "08:00", endTime: "12:00", department: "Cardiology" },
  { id: "6", day: "Friday", startTime: "08:00", endTime: "12:00", department: "Cardiology" },
];

interface ScheduleViewProps {
  staffId?: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function ScheduleView({ staffId }: ScheduleViewProps) {
  const schedule = MOCK_SCHEDULE;

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground font-headline">
          Weekly Schedule
        </h3>
      </div>
      <div className="space-y-2">
        {DAYS.map((day) => {
          const slots = schedule.filter((s) => s.day === day);
          return (
            <div key={day} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <span className="text-xs font-medium text-muted-foreground w-20 shrink-0 pt-0.5">
                {day}
              </span>
              {slots.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No shifts</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/5 border border-primary/10"
                    >
                      <Clock className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        {slot.startTime}–{slot.endTime}
                      </span>
                      <span className="text-xs text-muted-foreground">· {slot.department}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

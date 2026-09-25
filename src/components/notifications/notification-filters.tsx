"use client";

import { NOTIFICATION_TYPES } from "@/lib/validations/notification";

const TYPE_LABELS: Record<string, string> = {
  SYSTEM: "System",
  APPOINTMENT: "Appointment",
  PATIENT: "Patient",
  BILLING: "Billing",
  SECURITY: "Security",
};

interface NotificationFiltersProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  read: string;
  onReadChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
}

export function NotificationFilters({
  searchInput,
  onSearchChange,
  read,
  onReadChange,
  type,
  onTypeChange,
}: NotificationFiltersProps) {
  return (
    <div className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search title or message..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search notifications"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={read}
          onChange={(e) => onReadChange(e.target.value)}
          aria-label="Read state"
          className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          aria-label="Notification type"
          className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Types</option>
          {NOTIFICATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

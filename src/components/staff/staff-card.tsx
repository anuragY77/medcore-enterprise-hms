"use client";

import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffCardProps {
  staffId: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  specialization?: string | null;
  email: string;
  phone: string;
  qualification?: string | null;
  experience?: number | null;
  status: string;
  joiningDate?: string | null;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Inactive: "bg-slate-100 text-slate-800",
  "On Leave": "bg-amber-100 text-amber-800",
};

export function StaffCard({
  firstName,
  lastName,
  role,
  department,
  specialization,
  email,
  phone,
  qualification,
  experience,
  status,
  joiningDate,
  compact = false,
}: StaffCardProps) {
  const fullName = `${firstName} ${lastName}`;
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-primary">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground truncate">{role} · {department}</p>
        </div>
        <span
          className={cn(
            "ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
            STATUS_COLORS[status] ?? "bg-slate-100 text-slate-800"
          )}
        >
          {status}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-foreground font-headline truncate">
            {fullName}
          </h3>
          <p className="text-sm text-muted-foreground">{role} · {department}</p>
          {specialization && (
            <p className="text-sm text-muted-foreground">{specialization}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium text-foreground truncate">{email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium text-foreground">{phone}</p>
            </div>
            {qualification && (
              <div>
                <p className="text-muted-foreground">Qualification</p>
                <p className="font-medium text-foreground">{qualification}</p>
              </div>
            )}
            {experience != null && (
              <div>
                <p className="text-muted-foreground">Experience</p>
                <p className="font-medium text-foreground">{experience} years</p>
              </div>
            )}
            {joiningDate && (
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p className="font-medium text-foreground">
                  {new Date(joiningDate).toLocaleDateString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Status</p>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  STATUS_COLORS[status] ?? "bg-slate-100 text-slate-800"
                )}
              >
                {status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

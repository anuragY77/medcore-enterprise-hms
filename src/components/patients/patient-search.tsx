"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PatientSearch({
  value,
  onChange,
  placeholder = "Search patients by name, ID, phone, or email...",
  className,
}: PatientSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 text-sm bg-card border border-border/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

interface PatientStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const STATUS_OPTIONS = ["All", "Active", "Discharged", "Critical", "In Progress"];

export function PatientStatusFilter({
  value,
  onChange,
  className,
}: PatientStatusFilterProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {STATUS_OPTIONS.map((status) => (
        <button
          key={status}
          onClick={() => onChange(status)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            value === status
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {status}
        </button>
      ))}
    </div>
  );
}

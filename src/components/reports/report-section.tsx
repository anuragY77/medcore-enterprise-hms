"use client";

import type { ReactNode } from "react";

interface ReportSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function ReportSection({ title, description, children }: ReportSectionProps) {
  return (
    <section className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground font-headline">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
}

export function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

interface BreakdownListProps {
  title?: string;
  entries: [string, number][];
}

export function BreakdownList({ title, entries }: BreakdownListProps) {
  if (entries.length === 0) {
    return (
      <div>
        {title && (
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {title}
          </p>
        )}
        <p className="text-sm text-muted-foreground">No breakdown data.</p>
      </div>
    );
  }

  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div>
      {title && (
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          {title}
        </p>
      )}
      <ul className="space-y-2">
        {entries.map(([key, count]) => (
          <li key={key}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-sm text-foreground truncate">{key || "—"}</span>
              <span className="text-sm font-medium text-foreground tabular-nums shrink-0">
                {count.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

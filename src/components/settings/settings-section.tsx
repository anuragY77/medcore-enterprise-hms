"use client";

import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
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

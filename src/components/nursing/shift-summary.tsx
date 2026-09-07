"use client";

import { UserPlus, UserMinus, ArrowRightLeft } from "lucide-react";

interface ShiftSummaryProps {
  admissions: number;
  discharges: number;
  transfers: number;
  loading?: boolean;
}

export function ShiftSummary({ admissions, discharges, transfers, loading }: ShiftSummaryProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">Shift Summary</h3>
        <div className="text-center text-muted-foreground text-sm py-4">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">Shift Summary</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <UserPlus className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-foreground">{admissions}</p>
            <p className="text-xs text-muted-foreground">Admit</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <UserMinus className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-foreground">{discharges}</p>
            <p className="text-xs text-muted-foreground">Disch</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <ArrowRightLeft className="h-5 w-5 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-foreground">{transfers}</p>
            <p className="text-xs text-muted-foreground">Trans</p>
          </div>
        </div>
      </div>
    </div>
  );
}

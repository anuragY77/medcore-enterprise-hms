import type { DashboardFinancial } from "@/types/dashboard";

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface BillingSummaryProps {
  financial: DashboardFinancial;
}

export function BillingSummary({ financial }: BillingSummaryProps) {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
        Billing Summary
      </h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Invoiced</span>
          <span className="font-medium text-foreground">
            {formatMoney(financial.totalInvoiced)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Paid</span>
          <span className="font-medium text-status-available-foreground">
            {formatMoney(financial.totalPaid)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm pt-3 border-t border-border/50">
          <span className="text-muted-foreground">Outstanding</span>
          <span className="font-semibold text-destructive">
            {formatMoney(financial.outstanding)}
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  RefreshCw,
  Users,
  UserPlus,
  CalendarDays,
  BedDouble,
  Siren,
  Scissors,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  ReportCard,
  ReportSection,
  MetricRow,
  BreakdownList,
} from "@/components/reports";
import { hasPermission, type Role } from "@/types/auth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ReportsData {
  patients: {
    totalPatients: number;
    newPatients: number;
    patientsByStatus: Record<string, number>;
    patientsByGender: Record<string, number>;
    patientsByDepartment: Record<string, number>;
  };
  financial: {
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    invoiceCount: number;
    invoicesByStatus: Record<string, number>;
    claimCount: number;
    totalClaimAmount: number;
    totalApprovedAmount: number;
    claimsByStatus: Record<string, number>;
  };
  operations: {
    appointments: {
      total: number;
      byStatus: Record<string, number>;
    };
    beds: {
      total: number;
      occupied: number;
      available: number;
      occupancyPercentage: number;
      byStatus: Record<string, number>;
    };
    emergency: {
      total: number;
      byStatus: Record<string, number>;
    };
    surgeries: {
      total: number;
      byStatus: Record<string, number>;
    };
  };
}

interface ReportsMeta {
  from: string | null;
  to: string | null;
  generatedAt: string;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function toEntries(map: Record<string, number> | undefined): [string, number][] {
  if (!map) return [];
  return Object.entries(map).map(([k, v]) => [k, Number(v) || 0]);
}

function formatApiValidationError(details: unknown): string {
  if (details && typeof details === "object") {
    const messages: string[] = [];
    for (const value of Object.values(details as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const msg of value) {
          if (typeof msg === "string") messages.push(msg);
        }
      } else if (typeof value === "string") {
        messages.push(value);
      }
    }
    if (messages.length > 0) return messages.join(" ");
  }
  return "Invalid date range. Ensure From is on or before To.";
}

export default function ReportsPage() {
  const { data: session, status } = useSession();

  const [report, setReport] = useState<ReportsData | null>(null);
  const [meta, setMeta] = useState<ReportsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [localValidation, setLocalValidation] = useState<string | null>(null);

  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "reports:read") : false;

  const buildQueryString = useCallback(
    (fromVal: string, toVal: string) => {
      const params = new URLSearchParams();
      if (fromVal) params.set("from", fromVal);
      if (toVal) params.set("to", toVal);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    []
  );

  const fetchReports = useCallback(
    async (fromVal: string, toVal: string) => {
      try {
        const res = await fetch(`/api/reports${buildQueryString(fromVal, toVal)}`);
        setError(null);
        if (res.status === 401 || res.status === 403) {
          throw new Error("You do not have permission to view reports.");
        }
        if (res.status === 400) {
          const err = await res.json().catch(() => ({}));
          throw new Error(formatApiValidationError(err.details) || err.error || "Invalid report request.");
        }
        if (!res.ok) throw new Error("Failed to fetch reports");
        const payload = await res.json();
        setReport(payload.data ?? null);
        setMeta(payload.meta ?? null);
        if (!payload.data) {
          setError("No report data available for the selected period.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load reports");
        setReport(null);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [buildQueryString]
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !canRead) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports${buildQueryString(from, to)}`);
        if (res.status === 401 || res.status === 403) {
          throw new Error("You do not have permission to view reports.");
        }
        if (res.status === 400) {
          const err = await res.json().catch(() => ({}));
          throw new Error(formatApiValidationError(err.details) || err.error || "Invalid report request.");
        }
        if (!res.ok) throw new Error("Failed to fetch reports");
        const payload = await res.json();
        setReport(payload.data ?? null);
        setMeta(payload.meta ?? null);
        setError(payload.data ? null : "No report data available for the selected period.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load reports");
        setReport(null);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, canRead, from, to, buildQueryString]);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidation(null);
    if (fromInput && toInput && Date.parse(fromInput) > Date.parse(toInput)) {
      setLocalValidation("From date must be on or before To date.");
      return;
    }
    setLoading(true);
    if (fromInput === from && toInput === to) {
      fetchReports(from, to);
      return;
    }
    setFrom(fromInput);
    setTo(toInput);
  };

  const handleReset = () => {
    setLocalValidation(null);
    setFromInput("");
    setToInput("");
    setLoading(true);
    if (!from && !to) {
      fetchReports("", "");
      return;
    }
    setFrom("");
    setTo("");
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchReports(from, to);
  };

  const showAuthLoading = status === "loading";
  const showDenied = !showAuthLoading && (!session || !canRead);

  if (showAuthLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Reports" }]} />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const patients = report?.patients;
  const financial = report?.financial;
  const operations = report?.operations;
  const hasAnyData =
    !!report &&
    (!!patients ||
      !!financial ||
      !!operations);

  return (
    <div>
      <Breadcrumb items={[{ label: "Reports" }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operational summary across patients, billing, beds, emergency, and surgery
        </p>
      </div>

      {showDenied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            {!session
              ? "You must be signed in to view reports."
              : "You do not have permission to view reports."}
          </p>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleApply}
            className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="report-from">From</Label>
                <Input
                  id="report-from"
                  type="date"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="report-to">To</Label>
                <Input
                  id="report-to"
                  type="date"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <Button type="submit">Apply</Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                aria-label="Refresh reports"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </Button>
            </div>
            {localValidation && (
              <p className="text-sm text-destructive mt-3" role="alert">
                {localValidation}
              </p>
            )}
            {meta && (meta.from || meta.to) && (
              <p className="text-xs text-muted-foreground mt-3">
                Active range: {meta.from ?? "start"} → {meta.to ?? "latest"}
                {meta.generatedAt
                  ? ` · Generated ${new Date(meta.generatedAt).toLocaleString()}`
                  : ""}
              </p>
            )}
          </form>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm" aria-live="polite">
              Loading reports...
            </div>
          )}
          {error && !loading && (
            <div className="text-center py-12 text-destructive text-sm" role="alert">
              {error}
            </div>
          )}
          {!loading && !error && !hasAnyData && (
            <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
              <p className="text-sm text-muted-foreground">
                No report data available for the selected period.
              </p>
            </div>
          )}
          {!loading && !error && hasAnyData && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <ReportCard
                  label="Total Patients"
                  value={formatCount(report.patients.totalPatients)}
                  hint={`${formatCount(report.patients.newPatients)} new in range`}
                  icon={Users}
                />
                <ReportCard
                  label="New Patients"
                  value={formatCount(report.patients.newPatients)}
                  icon={UserPlus}
                  color="text-blue-600"
                />
                <ReportCard
                  label="Appointments"
                  value={formatCount(report.operations.appointments.total)}
                  icon={CalendarDays}
                  color="text-indigo-600"
                />
                <ReportCard
                  label="Bed Occupancy"
                  value={formatPercent(report.operations.beds.occupancyPercentage)}
                  hint={`${formatCount(report.operations.beds.occupied)} of ${formatCount(report.operations.beds.total)} beds`}
                  icon={BedDouble}
                  color="text-emerald-600"
                />
                <ReportCard
                  label="Emergency Cases"
                  value={formatCount(report.operations.emergency.total)}
                  icon={Siren}
                  color="text-red-600"
                />
                <ReportCard
                  label="Surgeries"
                  value={formatCount(report.operations.surgeries.total)}
                  icon={Scissors}
                  color="text-rose-600"
                />
                <ReportCard
                  label="Invoices"
                  value={formatCount(report.financial.invoiceCount)}
                  hint={`Outstanding ${formatMoney(report.financial.totalOutstanding)}`}
                  icon={Receipt}
                  color="text-amber-600"
                />
                <ReportCard
                  label="Insurance Claims"
                  value={formatCount(report.financial.claimCount)}
                  hint={`Approved ${formatMoney(report.financial.totalApprovedAmount)}`}
                  icon={AlertTriangle}
                  color="text-cyan-600"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ReportSection
                  title="Patient Metrics"
                  description="Patient totals and distributions"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <MetricRow
                        label="Total patients"
                        value={formatCount(report.patients.totalPatients)}
                      />
                      <MetricRow
                        label="New patients (range)"
                        value={formatCount(report.patients.newPatients)}
                      />
                      <div className="mt-4">
                        <BreakdownList
                          title="By status"
                          entries={toEntries(report.patients.patientsByStatus)}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <BreakdownList
                        title="By gender"
                        entries={toEntries(report.patients.patientsByGender)}
                      />
                      <BreakdownList
                        title="By department"
                        entries={toEntries(report.patients.patientsByDepartment)}
                      />
                    </div>
                  </div>
                </ReportSection>

                <ReportSection
                  title="Appointments"
                  description="Appointment volume and status mix"
                >
                  <MetricRow
                    label="Total appointments"
                    value={formatCount(report.operations.appointments.total)}
                  />
                  <div className="mt-4">
                    <BreakdownList
                      title="By status"
                      entries={toEntries(report.operations.appointments.byStatus)}
                    />
                  </div>
                </ReportSection>

                <ReportSection
                  title="Billing / Insurance"
                  description="Invoice and claim totals for the selected range"
                >
                  <MetricRow
                    label="Total invoiced"
                    value={formatMoney(report.financial.totalInvoiced)}
                  />
                  <MetricRow
                    label="Total paid"
                    value={formatMoney(report.financial.totalPaid)}
                  />
                  <MetricRow
                    label="Total outstanding"
                    value={formatMoney(report.financial.totalOutstanding)}
                  />
                  <MetricRow
                    label="Invoice count"
                    value={formatCount(report.financial.invoiceCount)}
                  />
                  <MetricRow
                    label="Claim count"
                    value={formatCount(report.financial.claimCount)}
                  />
                  <MetricRow
                    label="Total claim amount"
                    value={formatMoney(report.financial.totalClaimAmount)}
                  />
                  <MetricRow
                    label="Total approved amount"
                    value={formatMoney(report.financial.totalApprovedAmount)}
                  />
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <BreakdownList
                      title="Invoices by status"
                      entries={toEntries(report.financial.invoicesByStatus)}
                    />
                    <BreakdownList
                      title="Claims by status"
                      entries={toEntries(report.financial.claimsByStatus)}
                    />
                  </div>
                </ReportSection>

                <ReportSection
                  title="Bed Utilization"
                  description="Point-in-time bed inventory (not date-filtered)"
                >
                  <MetricRow
                    label="Total beds"
                    value={formatCount(report.operations.beds.total)}
                  />
                  <MetricRow
                    label="Occupied"
                    value={formatCount(report.operations.beds.occupied)}
                  />
                  <MetricRow
                    label="Available"
                    value={formatCount(report.operations.beds.available)}
                  />
                  <MetricRow
                    label="Occupancy"
                    value={formatPercent(report.operations.beds.occupancyPercentage)}
                  />
                  <div className="mt-4">
                    <BreakdownList
                      title="By status"
                      entries={toEntries(report.operations.beds.byStatus)}
                    />
                  </div>
                </ReportSection>

                <ReportSection
                  title="Emergency"
                  description="Emergency cases in the selected range"
                >
                  <MetricRow
                    label="Total cases"
                    value={formatCount(report.operations.emergency.total)}
                  />
                  <div className="mt-4">
                    <BreakdownList
                      title="By status"
                      entries={toEntries(report.operations.emergency.byStatus)}
                    />
                  </div>
                </ReportSection>

                <ReportSection
                  title="Surgery"
                  description="Surgeries in the selected range"
                >
                  <MetricRow
                    label="Total surgeries"
                    value={formatCount(report.operations.surgeries.total)}
                  />
                  <div className="mt-4">
                    <BreakdownList
                      title="By status"
                      entries={toEntries(report.operations.surgeries.byStatus)}
                    />
                  </div>
                </ReportSection>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

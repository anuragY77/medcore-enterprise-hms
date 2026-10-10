"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt, DollarSign, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { InvoiceTable, InvoiceForm, type Invoice } from "@/components/billing";
import { EMPTY_LIST_META, PaginationBar, type ListMeta } from "@/components/ui/pagination-bar";

const PAYMENT_METHODS = ["Cash", "Credit Card", "Debit Card", "Insurance", "Bank Transfer", "Check", "Online"];

export default function BillingPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_LIST_META);
  const [denied, setDenied] = useState(false);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [searchTick, setSearchTick] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined);

  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [patientFilter, setPatientFilter] = useState<string | null>(null);
  const patientFilterRef = useRef<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    let redirecting = false;
    setLoading(true);
    setError(null);
    setDenied(false);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (paymentMethodFilter) params.set("paymentMethod", paymentMethodFilter);
      if (patientFilterRef.current) params.set("patientId", patientFilterRef.current);
      params.set("page", String(page));
      params.set("pageSize", "10");

      const res = await fetch(`/api/billing?${params.toString()}`);
      if (res.status === 401) {
        redirecting = true;
        router.push(`/login?callbackUrl=${encodeURIComponent("/billing")}`);
        return;
      }
      if (res.status === 403) {
        setDenied(true);
        setInvoices([]);
        setMeta(EMPTY_LIST_META);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();
      setInvoices(data.data);
      setMeta(data.meta ?? EMPTY_LIST_META);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      if (!redirecting) setLoading(false);
    }
  }, [query, statusFilter, paymentMethodFilter, page, router]);

  useEffect(() => {
    const load = async () => {
      const patientId = new URLSearchParams(window.location.search).get("patientId");
      if (patientId) {
        patientFilterRef.current = patientId;
        setPatientFilter(patientId);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const fetchKey = [query, statusFilter, paymentMethodFilter, page, searchTick].join("|");
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    fetchInvoices();
  }, [fetchInvoices, query, statusFilter, paymentMethodFilter, page, searchTick]);

  const clearPatientFilter = () => {
    patientFilterRef.current = null;
    setPatientFilter(null);
    setLoading(true);
    setPage(1);
    setSearchTick((tick) => tick + 1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setQuery(searchQuery);
    setPage(1);
    setSearchTick((tick) => tick + 1);
  };

  const handleStatusFilter = (value: string) => {
    if (value === statusFilter) return;
    setLoading(true);
    setStatusFilter(value);
    setPage(1);
  };

  const handlePaymentMethodFilter = (value: string) => {
    if (value === paymentMethodFilter) return;
    setLoading(true);
    setPaymentMethodFilter(value);
    setPage(1);
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormOpen(true);
  };

  const handleDeleteRequest = (invoice: Invoice) => {
    setDeleteError(null);
    setConfirmDelete(invoice);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete || deleting) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      const res = await fetch(`/api/billing/${confirmDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to delete invoice");
      }
      setConfirmDelete(null);
      fetchInvoices();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete invoice");
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    setEditingInvoice(undefined);
    fetchInvoices();
  };

  const totalInvoices = meta.total;
  const paidInvoices = meta.statusCounts?.["Paid"] ?? 0;
  const pendingInvoices = meta.statusCounts?.["Pending"] ?? 0;
  const overdueInvoices = meta.statusCounts?.["Overdue"] ?? 0;

  return (
    <div>
      <Breadcrumb items={[{ label: "Billing" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Billing & Payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Financial operations and invoicing
          </p>
        </div>
        <button
          onClick={() => {
            setEditingInvoice(undefined);
            setFormOpen(true);
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4 inline-block mr-1 -mt-0.5" />
          Create Invoice
        </button>
      </div>

      {denied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view invoices.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{totalInvoices}</p>
                  <p className="text-xs text-muted-foreground">Total Invoices</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{paidInvoices}</p>
                  <p className="text-xs text-muted-foreground">Paid</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{pendingInvoices}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{overdueInvoices}</p>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
              </div>
            </div>
          </div>

          {patientFilter && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filtered by patient:</span>
              <span className="font-mono text-xs px-2 py-1 rounded-md bg-muted text-foreground">
                {patientFilter}
              </span>
              <button
                onClick={clearPatientFilter}
                className="px-3 py-1.5 rounded-md border border-border/50 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          <form onSubmit={handleSearch} className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by invoice ID, description, payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                aria-label="Status"
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                aria-label="Payment method"
                value={paymentMethodFilter}
                onChange={(e) => handlePaymentMethodFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Search
              </button>
              <button
                aria-label="Refresh list"
                type="button"
                onClick={fetchInvoices}
                className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </form>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading invoices...</div>
          )}
          {error && !loading && (
            <div className="text-center py-12 text-sm">
              <p className="text-destructive mb-3">{error}</p>
              <button
                onClick={fetchInvoices}
                className="px-4 py-2 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !error && (
            <InvoiceTable invoices={invoices} onEdit={handleEdit} onDelete={handleDeleteRequest} />
          )}
          {!loading && !error && (
            <div className="mt-4">
              <PaginationBar meta={meta} onPageChange={handlePageChange} noun="invoice" />
            </div>
          )}
        </>
      )}

      <InvoiceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingInvoice}
        mode={editingInvoice ? "edit" : "create"}
        onSuccess={handleFormSuccess}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border border-border/50 p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Confirm Delete</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete invoice <strong>{confirmDelete.invoiceId}</strong>?
              This action cannot be undone.
            </p>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md text-sm mb-4">
                {deleteError}
              </div>
            )}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

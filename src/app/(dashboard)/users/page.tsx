"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  UserTable,
  UserForm,
  type UserRecord,
  type UsersMeta,
} from "@/components/users";
import { hasPermission, ROLES, ROLE_LABELS, type Role } from "@/types/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const DEPARTMENT_OPTIONS = [
  "Administration",
  "Cardiology",
  "Emergency",
  "Front Desk",
  "Pharmacy",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Radiology",
  "Laboratory",
  "Nursing",
];

const EMPTY_META: UsersMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };

export default function UsersPage() {
  const { data: session, status } = useSession();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [meta, setMeta] = useState<UsersMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [viewUser, setViewUser] = useState<UserRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "users:read") : false;
  const canWrite = role ? hasPermission(role, "users:write") : false;
  const canDelete = role ? hasPermission(role, "users:delete") : false;
  const currentUserId = session?.user?.id;

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      params.set("page", String(page));
      params.set("pageSize", "20");

      const res = await fetch(`/api/users?${params.toString()}`);
      setError(null);
      if (res.status === 401 || res.status === 403) {
        throw new Error("You do not have permission to view users.");
      }
      if (!res.ok) throw new Error("Failed to fetch users");
      const payload = await res.json();
      setUsers(payload.data ?? []);
      setMeta(payload.meta ?? EMPTY_META);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
      setUsers([]);
      setMeta(EMPTY_META);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, departmentFilter, page]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !canRead) return;
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (roleFilter) params.set("role", roleFilter);
        if (departmentFilter) params.set("department", departmentFilter);
        params.set("page", String(page));
        params.set("pageSize", "20");

        const res = await fetch(`/api/users?${params.toString()}`);
        if (res.status === 401 || res.status === 403) {
          throw new Error("You do not have permission to view users.");
        }
        if (!res.ok) throw new Error("Failed to fetch users");
        const payload = await res.json();
        setUsers(payload.data ?? []);
        setMeta(payload.meta ?? EMPTY_META);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
        setUsers([]);
        setMeta(EMPTY_META);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, canRead, search, roleFilter, departmentFilter, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (search === searchInput && page === 1) {
      fetchUsers();
      return;
    }
    setSearch(searchInput);
    setPage(1);
  };

  const handleRoleFilter = (value: string) => {
    setLoading(true);
    setRoleFilter(value);
    setPage(1);
  };

  const handleDepartmentFilter = (value: string) => {
    setLoading(true);
    setDepartmentFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchUsers();
  };

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setLoading(true);
    setPage(next);
  };

  const handleFormSuccess = () => {
    setLoading(true);
    if (page !== 1) {
      setPage(1);
      return;
    }
    fetchUsers();
  };

  const handleEdit = (user: UserRecord) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleEditSuccess = () => {
    setEditingUser(null);
    setLoading(true);
    fetchUsers();
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingUser(null);
    }
  };

  const handleDeleteRequest = (user: UserRecord) => {
    setDeleteError(null);
    setConfirmDelete(user);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete || deleting) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      const res = await fetch(`/api/users/${confirmDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to delete user");
      }
      setConfirmDelete(null);
      if (users.length === 1 && page > 1) {
        setPage(page - 1);
        return;
      }
      setLoading(true);
      fetchUsers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const showAuthLoading = status === "loading";
  const showDenied = !showAuthLoading && (!session || !canRead);

  if (showAuthLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Users & Roles" }]} />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Users & Roles" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Users & Roles Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            User management and role assignments
          </p>
        </div>
        {canWrite && !showDenied && (
          <button
            onClick={() => {
              setEditingUser(null);
              setFormOpen(true);
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4 inline-block mr-1 -mt-0.5" />
            Add User
          </button>
        )}
      </div>

      {showDenied ? (
        <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
            Access Denied
          </h3>
          <p className="text-sm text-muted-foreground">
            {!session
              ? "You must be signed in to view users."
              : "You do not have permission to view users."}
          </p>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSearch}
            className="mb-6 bg-card rounded-lg border border-border/50 p-4 shadow-sm"
          >
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={roleFilter}
                onChange={(e) => handleRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Roles</option>
                {Object.values(ROLES).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <select
                value={departmentFilter}
                onChange={(e) => handleDepartmentFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Departments</option>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </form>

          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Loading users...
            </div>
          )}
          {error && !loading && (
            <div className="text-center py-12 text-destructive text-sm">{error}</div>
          )}
          {!loading && !error && (
            <UserTable
              users={users}
              meta={meta}
              onPageChange={handlePageChange}
              onView={setViewUser}
              onEdit={canWrite ? handleEdit : undefined}
              onDelete={canDelete ? handleDeleteRequest : undefined}
              currentUserId={currentUserId}
            />
          )}

          <UserForm
            open={formOpen}
            onOpenChange={handleFormOpenChange}
            initialData={editingUser ?? undefined}
            mode={editingUser ? "edit" : "create"}
            onSuccess={editingUser ? handleEditSuccess : handleFormSuccess}
          />

          <Sheet open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>User Details</SheetTitle>
                <SheetDescription>View user profile information.</SheetDescription>
              </SheetHeader>
              {viewUser && (
                <div className="space-y-4 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base font-semibold">
                      {viewUser.avatar || viewUser.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{viewUser.name}</p>
                      <p className="text-muted-foreground">{viewUser.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Role</p>
                      <p className="text-foreground">
                        {ROLE_LABELS[viewUser.role as Role] ?? viewUser.role}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Department</p>
                      <p className="text-foreground">{viewUser.department}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Created</p>
                      <p className="text-foreground">
                        {viewUser.createdAt
                          ? new Date(viewUser.createdAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Updated</p>
                      <p className="text-foreground">
                        {viewUser.updatedAt
                          ? new Date(viewUser.updatedAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-card rounded-lg border border-border/50 p-6 shadow-lg max-w-sm w-full mx-4">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Confirm Delete
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Delete user <strong>{confirmDelete.name}</strong>? This action
                  cannot be undone.
                </p>
                {deleteError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm mb-4">
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
        </>
      )}
    </div>
  );
}

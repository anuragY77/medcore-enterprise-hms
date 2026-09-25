"use client";

import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/types/auth";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsersMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UserTableProps {
  users: UserRecord[];
  meta: UsersMeta;
  onPageChange: (page: number) => void;
  onView: (user: UserRecord) => void;
  onEdit?: (user: UserRecord) => void;
  onDelete?: (user: UserRecord) => void;
  currentUserId?: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  DOCTOR: "bg-blue-100 text-blue-800",
  NURSE: "bg-emerald-100 text-emerald-800",
  RECEPTIONIST: "bg-amber-100 text-amber-800",
  PHARMACIST: "bg-teal-100 text-teal-800",
  LAB_TECHNICIAN: "bg-cyan-100 text-cyan-800",
  BILLING: "bg-indigo-100 text-indigo-800",
  SURGEON: "bg-rose-100 text-rose-800",
  SECURITY: "bg-slate-100 text-slate-800",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserTable({ users, meta, onPageChange, onView, onEdit, onDelete, currentUserId }: UserTableProps) {
  const { page, pageSize, total, totalPages } = meta;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {user.avatar || initials(user.name)}
                      </div>
                      <span className="font-medium text-foreground">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-800"
                      )}
                    >
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.department}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onView(user)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="View user"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {onEdit && (
                        <button
                          onClick={() => onEdit(user)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(user)}
                          disabled={user.id === currentUserId}
                          title={
                            user.id === currentUserId
                              ? "You cannot delete your own account"
                              : "Delete user"
                          }
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-muted disabled:hover:text-muted-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing {start}–{end} of {total} users
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

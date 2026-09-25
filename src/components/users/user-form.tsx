"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserData,
} from "@/lib/validations/user";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ROLES, ROLE_LABELS } from "@/types/auth";

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

interface UserFormInitialData {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar: string | null;
}

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: UserFormInitialData;
  mode?: "create" | "edit";
  onSuccess: () => void;
}

export function UserForm({
  open,
  onOpenChange,
  initialData,
  mode = "create",
  onSuccess,
}: UserFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = mode === "edit";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserData>({
    resolver: zodResolver(
      isEdit ? updateUserSchema : createUserSchema
    ) as unknown as Resolver<CreateUserData>,
    defaultValues: isEdit && initialData
      ? {
          name: initialData.name,
          email: initialData.email,
          role: initialData.role as CreateUserData["role"],
          department: initialData.department,
          avatar: initialData.avatar ?? "",
        }
      : {
          name: "",
          email: "",
          password: "",
          role: undefined,
          department: "",
          avatar: "",
        },
  });

  const onSubmit = async (data: CreateUserData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);

      const url = isEdit && initialData
        ? `/api/users/${initialData.id}`
        : "/api/users";

      const payload = isEdit
        ? {
            name: data.name,
            email: data.email,
            role: data.role,
            department: data.department,
            avatar: data.avatar ?? "",
          }
        : data;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save user");
      }

      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setServerError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{isEdit ? "Edit User" : "Create User"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update user details and role assignment."
              : "Add a new user and assign a role."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              {serverError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("name")}
              placeholder="e.g. Dr. Sarah Patel"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              {...register("email")}
              placeholder="e.g. user@medcore.com"
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Password <span className="text-destructive">*</span>
              </label>
              <input
                type="password"
                {...register("password")}
                placeholder="Minimum 6 characters"
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Role <span className="text-destructive">*</span>
              </label>
              <select
                {...register("role")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select role</option>
                {Object.values(ROLES).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              {errors.role && (
                <p className="text-xs text-destructive mt-1">{errors.role.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Department <span className="text-destructive">*</span>
              </label>
              <select
                {...register("department")}
                className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select department</option>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {errors.department && (
                <p className="text-xs text-destructive mt-1">{errors.department.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Avatar initials
            </label>
            <input
              {...register("avatar")}
              placeholder="e.g. SP (max 10 chars)"
              maxLength={10}
              className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.avatar && (
              <p className="text-xs text-destructive mt-1">{errors.avatar.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : isEdit ? "Update User" : "Create User"}
            </button>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="px-4 py-2 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

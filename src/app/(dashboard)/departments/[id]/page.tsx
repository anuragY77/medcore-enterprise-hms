"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DepartmentCard, type Department } from "@/components/departments";

export default function DepartmentDetailPage() {
  const params = useParams();
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepartment = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/departments/${params.id}`);
        if (!res.ok) throw new Error("Failed to fetch department");
        const data = await res.json();
        setDepartment(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load department");
      } finally {
        setLoading(false);
      }
    };
    fetchDepartment();
  }, [params.id]);

  if (loading) {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Departments", href: "/departments" },
            { label: "Loading..." },
          ]}
        />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading department...</div>
      </div>
    );
  }

  if (error || !department) {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Departments", href: "/departments" },
            { label: "Error" },
          ]}
        />
        <div className="text-center py-12 text-destructive text-sm">{error || "Department not found"}</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Departments", href: "/departments" },
          { label: department.name },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          {department.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Department details and information
        </p>
      </div>

      <DepartmentCard
        departmentId={department.departmentId}
        name={department.name}
        description={department.description}
        headDoctor={department.headDoctor}
        phone={department.phone}
        location={department.location}
        totalBeds={department.totalBeds}
        status={department.status}
      />

      <div className="mt-6 bg-card rounded-lg border border-border/50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground font-headline mb-4">Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Department ID</p>
            <p className="text-sm font-medium text-foreground">{department.departmentId}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                department.status === "Active"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              {department.status}
            </span>
          </div>
          {department.headDoctor && (
            <div>
              <p className="text-sm text-muted-foreground">Head Doctor</p>
              <p className="text-sm font-medium text-foreground">{department.headDoctor}</p>
            </div>
          )}
          {department.phone && (
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="text-sm font-medium text-foreground">{department.phone}</p>
            </div>
          )}
          {department.location && (
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="text-sm font-medium text-foreground">{department.location}</p>
            </div>
          )}
          {department.totalBeds != null && (
            <div>
              <p className="text-sm text-muted-foreground">Total Beds</p>
              <p className="text-sm font-medium text-foreground">{department.totalBeds}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

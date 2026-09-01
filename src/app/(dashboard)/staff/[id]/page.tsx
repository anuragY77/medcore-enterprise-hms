"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StaffCard, ScheduleView } from "@/components/staff";

interface StaffMember {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  specialization: string | null;
  qualification: string | null;
  experience: number | null;
  status: string;
  joiningDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function StaffProfilePage() {
  const params = useParams();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/staff/${params.id}`);
        if (!res.ok) throw new Error("Staff not found");
        const data = await res.json();
        setStaff(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load staff");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) fetchStaff();
  }, [params.id]);

  if (loading) {
    return (
      <div>
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div>
        <div className="text-center py-12 text-destructive text-sm">{error || "Staff not found"}</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Staff", href: "/staff" },
          { label: `${staff.firstName} ${staff.lastName}` },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Staff Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {staff.firstName} {staff.lastName} - {staff.department}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <StaffCard
            staffId={staff.staffId}
            firstName={staff.firstName}
            lastName={staff.lastName}
            role={staff.role}
            department={staff.department}
            specialization={staff.specialization}
            email={staff.email}
            phone={staff.phone}
            qualification={staff.qualification}
            experience={staff.experience}
            status={staff.status}
            joiningDate={staff.joiningDate}
          />
          <ScheduleView staffId={staff.id} />
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border/50 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground font-headline mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors">
                Edit Profile
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors">
                View Schedule
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors text-destructive">
                Deactivate Staff
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

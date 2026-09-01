"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PatientTable } from "@/components/patients/patient-table";
import { PatientSearch, PatientStatusFilter } from "@/components/patients/patient-search";
import { mockPatients } from "@/components/patients/patient-data";

export default function PatientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredPatients = useMemo(() => {
    return mockPatients.filter((patient) => {
      const matchesSearch =
        !searchQuery ||
        `${patient.firstName} ${patient.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        patient.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone.includes(searchQuery) ||
        (patient.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === "All" || patient.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  return (
    <div>
      <Breadcrumb items={[{ label: "Patients" }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Patient Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage patient registry, search, and profiles
          </p>
        </div>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Patient
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <PatientSearch
          value={searchQuery}
          onChange={setSearchQuery}
          className="w-full sm:w-80"
        />
        <PatientStatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        {filteredPatients.length} patient{filteredPatients.length !== 1 ? "s" : ""} found
      </div>

      <PatientTable patients={filteredPatients} />
    </div>
  );
}

import { Breadcrumb } from "@/components/layout/breadcrumb";

export default function NewPatientPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: "New Registration" },
        ]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            New Patient Registration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register a new patient in the system
          </p>
        </div>
      </div>
      <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl text-muted-foreground">🚧</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground font-headline mb-1">
          Coming Soon
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Patient registration form will be implemented in Phase 4.
        </p>
      </div>
    </div>
  );
}

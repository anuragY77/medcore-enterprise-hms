import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BreadcrumbItem } from "@/components/layout/breadcrumb";

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  breadcrumbs?: BreadcrumbItem[];
}

function PlaceholderPage({ title, subtitle, breadcrumbs = [] }: PlaceholderPageProps) {
  return (
    <div>
      <Breadcrumb items={breadcrumbs} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
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
          This screen will be implemented in a future phase.
        </p>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <PlaceholderPage
      title="Patient Management"
      subtitle="Manage patient registry, search, and profiles"
      breadcrumbs={[{ label: "Patients" }]}
    />
  );
}

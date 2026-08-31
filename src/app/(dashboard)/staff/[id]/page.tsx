import { Breadcrumb } from "@/components/layout/breadcrumb";

export default function StaffProfilePage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Staff", href: "/staff" },
          { label: "Dr. Sarah Patel" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Staff Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dr. Sarah Patel - Cardiology
        </p>
      </div>
      <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl text-muted-foreground">🚧</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground font-headline mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-sm">Staff profile will be implemented in Phase 6.</p>
      </div>
    </div>
  );
}

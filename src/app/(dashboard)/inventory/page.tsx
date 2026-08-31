import { Breadcrumb } from "@/components/layout/breadcrumb";

export default function InventoryPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Inventory" }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground font-headline">
          Inventory Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Supply stock levels and reorder alerts
        </p>
      </div>
      <div className="bg-card rounded-lg border border-border/50 p-12 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl text-muted-foreground">🚧</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground font-headline mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-sm">Inventory will be implemented in Phase 8.</p>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SettingsSection } from "@/components/settings";
import { hasPermission, ROLE_LABELS, type Role } from "@/types/auth";
import { cn } from "@/lib/utils";

interface SettingsData {
  application: {
    name: string;
    description: string;
    version: string;
    framework: {
      next: string;
      react: string;
    };
  };
  designSystem: {
    name: string;
    colors: {
      primary: string;
      secondary: string;
      background: string;
      foreground: string;
    };
    typography: {
      headline: string;
      body: string;
    };
    radii: {
      button: number;
      card: number;
    };
  };
  departments: string[];
  roles: string[];
  permissions: string[];
  status: {
    application: string;
  };
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "settings:read") : false;

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      setError(null);
      if (res.status === 401 || res.status === 403) {
        throw new Error("You do not have permission to view settings.");
      }
      if (!res.ok) throw new Error("Failed to fetch settings");
      const payload = await res.json();
      setSettings(payload.data ?? null);
      if (!payload.data) {
        setError("No settings data available.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !canRead) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/settings");
        if (res.status === 401 || res.status === 403) {
          throw new Error("You do not have permission to view settings.");
        }
        if (!res.ok) throw new Error("Failed to fetch settings");
        const payload = await res.json();
        setSettings(payload.data ?? null);
        setError(payload.data ? null : "No settings data available.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
        setSettings(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, canRead]);

  const handleRefresh = () => {
    setLoading(true);
    fetchSettings();
  };

  const showAuthLoading = status === "loading";
  const showDenied = !showAuthLoading && (!session || !canRead);

  if (showAuthLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Settings" }]} />
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Settings" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-headline">
            Settings &amp; Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            System configuration and administration
          </p>
        </div>
        {!showDenied && (
          <button
            onClick={handleRefresh}
            className="px-3 py-2 rounded-md border border-border/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
            title="Refresh settings"
          >
            <RefreshCw className="h-4 w-4" />
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
              ? "You must be signed in to view settings."
              : "You do not have permission to view settings."}
          </p>
        </div>
      ) : (
        <>
          {loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Loading settings...
            </div>
          )}
          {error && !loading && (
            <div className="text-center py-12 text-destructive text-sm">{error}</div>
          )}
          {!loading && !error && settings && (
            <div className="space-y-6">
              <SettingsSection
                title="System / Application"
                description="Application identity and runtime stack"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Name</p>
                    <p className="text-foreground font-medium">{settings.application.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Version</p>
                    <p className="text-foreground font-medium">{settings.application.version}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-foreground">{settings.application.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Next.js</p>
                    <p className="text-foreground">{settings.application.framework.next}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">React</p>
                    <p className="text-foreground">{settings.application.framework.react}</p>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Design System"
                description={settings.designSystem.name}
              >
                <div className="space-y-5 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Colors</p>
                    <div className="flex flex-wrap gap-3">
                      {(
                        [
                          ["Primary", settings.designSystem.colors.primary],
                          ["Secondary", settings.designSystem.colors.secondary],
                          ["Background", settings.designSystem.colors.background],
                          ["Foreground", settings.designSystem.colors.foreground],
                        ] as const
                      ).map(([label, hex]) => (
                        <div
                          key={label}
                          className="flex items-center gap-2 border border-border/50 rounded-md px-3 py-2"
                        >
                          <span
                            className="h-5 w-5 rounded border border-border/50 shrink-0"
                            style={{ backgroundColor: hex }}
                          />
                          <div>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-foreground font-medium">{hex}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Headline font</p>
                      <p className="text-foreground">{settings.designSystem.typography.headline}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Body font</p>
                      <p className="text-foreground">{settings.designSystem.typography.body}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Button radius</p>
                      <p className="text-foreground">{settings.designSystem.radii.button}px</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Card radius</p>
                      <p className="text-foreground">{settings.designSystem.radii.card}px</p>
                    </div>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Departments"
                description="Hospital departments available in the system"
              >
                {settings.departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No departments configured.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {settings.departments.map((dept) => (
                      <span
                        key={dept}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
                      >
                        {dept}
                      </span>
                    ))}
                  </div>
                )}
              </SettingsSection>

              <SettingsSection
                title="Roles"
                description="User roles defined in the access model"
              >
                {settings.roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles defined.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {settings.roles.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground border border-border/50"
                        title={r}
                      >
                        {roleLabel(r)}
                      </span>
                    ))}
                  </div>
                )}
              </SettingsSection>

              <SettingsSection
                title="Permissions"
                description="Permission strings granted across roles"
              >
                {settings.permissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No permissions defined.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {settings.permissions.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </SettingsSection>

              <SettingsSection
                title="Status"
                description="Application system status"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                      settings.status.application === "operational"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {settings.status.application}
                  </span>
                  <p className="text-muted-foreground">
                    Application status reported by the settings API.
                  </p>
                </div>
              </SettingsSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}

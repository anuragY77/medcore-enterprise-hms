import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission, ROLES, ROLE_PERMISSIONS } from "@/types/auth";
import { db, departments } from "@/lib/db";
import packageJson from "../../../../package.json";

// Settings are read-only display configuration; no persistent settings table exists yet.
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "settings:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const departmentRows = await db
      .select({ name: departments.name })
      .from(departments)
      .orderBy(sql`${departments.name} ASC`);

    const permissions = [
      ...new Set(Object.values(ROLE_PERMISSIONS).flat()),
    ].sort();

    return NextResponse.json({
      data: {
        application: {
          name: "MedCore Premium - Hospital Management System",
          description:
            "Enterprise-grade hospital management system for clinical environments",
          version: packageJson.version,
          framework: {
            next: packageJson.dependencies.next,
            react: packageJson.dependencies.react,
          },
        },
        designSystem: {
          name: "Clinical Precision",
          colors: {
            primary: "#064E3B",
            secondary: "#1E293B",
            background: "#F8F9FF",
            foreground: "#0B1C30",
          },
          typography: {
            headline: "Plus Jakarta Sans",
            body: "Inter",
          },
          radii: {
            button: 4,
            card: 8,
          },
        },
        departments: departmentRows.map((row) => row.name),
        roles: Object.values(ROLES),
        permissions,
        status: {
          application: "operational",
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

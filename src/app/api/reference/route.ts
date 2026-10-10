import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { loadReferenceOptions } from "@/lib/reference";

// Phase 28: authoritative dropdown data for patient registration (and any
// other form that needs departments/doctors). Gated on patients:write — the
// permission every patient-creation role holds (ADMIN/DOCTOR/NURSE/
// RECEPTIONIST/SURGEON) — so roles that cannot create patients get 403, and
// the response never leaks beyond option labels (names only, no staff ids,
// emails, or contact data).
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "patients:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const options = await loadReferenceOptions();
    return NextResponse.json(options);
  } catch (error) {
    console.error("Failed to load reference options:", error);
    return NextResponse.json(
      { error: "Failed to load reference options" },
      { status: 500 }
    );
  }
}

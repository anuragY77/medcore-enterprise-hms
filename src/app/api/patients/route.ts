import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, patients } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";
import { patientDateOfBirthSchema } from "@/lib/validations/patient";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "patients:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const pagination = paginationSchema(10).safeParse({
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });

    if (!pagination.success) {
      return NextResponse.json(
        { error: "Validation failed", details: pagination.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { page, pageSize } = pagination.data;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(patients.firstName, `%${query}%`),
          ilike(patients.lastName, `%${query}%`),
          ilike(patients.patientId, `%${query}%`),
          ilike(patients.phone, `%${query}%`),
          ilike(patients.email, `%${query}%`)
        )
      );
    }

    if (status && status !== "All") {
      conditions.push(eq(patients.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, patientsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(whereClause),
      db
        .select()
        .from(patients)
        .where(whereClause)
        .orderBy(sql`${patients.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      patients: patientsList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Failed to fetch patients:", error);
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "patients:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      bloodGroup,
      phone,
      email,
      address,
      department,
      attendingDoctor,
      status,
      insuranceProvider,
      insurancePolicyNumber,
      emergencyContactName,
      emergencyContactPhone,
    } = body;

    if (!firstName || !lastName || !dateOfBirth || !gender || !phone || !department || !attendingDoctor) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const dobParsed = z
      .object({ dateOfBirth: patientDateOfBirthSchema })
      .safeParse({ dateOfBirth });

    if (!dobParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: dobParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const patientCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(patients);

    const nextNumber = Number(patientCount[0]?.count ?? 0) + 10482;
    const patientId = `PT-${nextNumber}`;

    const [newPatient] = await db
      .insert(patients)
      .values({
        patientId,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        bloodGroup: bloodGroup || null,
        phone,
        email: email || null,
        address: address || null,
        department,
        attendingDoctor,
        status: status || "Active",
        insuranceProvider: insuranceProvider || null,
        insurancePolicyNumber: insurancePolicyNumber || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
      })
      .returning();

    return NextResponse.json(newPatient, { status: 201 });
  } catch (error) {
    console.error("Failed to create patient:", error);
    return NextResponse.json(
      { error: "Failed to create patient" },
      { status: 500 }
    );
  }
}

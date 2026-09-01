import { NextRequest, NextResponse } from "next/server";
import { eq, or, ilike, sql } from "drizzle-orm";
import { db, patients } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "All";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
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

    const whereClause = conditions.length > 0 ? sql`${conditions[0]}` : undefined;

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

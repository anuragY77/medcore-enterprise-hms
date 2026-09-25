import { NextRequest, NextResponse } from "next/server";
import { and, eq, or, ilike, sql, asc, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, medicalRecords, patients } from "@/lib/db";
import { recordQuerySchema } from "@/lib/validations/record";

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
    const raw: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (value !== "") {
        raw[key] = value;
      }
    });

    const parsed = recordQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { search, recordType, patientId, order, page, pageSize } = parsed.data;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(medicalRecords.title, `%${search}%`),
          ilike(medicalRecords.description, `%${search}%`),
          ilike(medicalRecords.recordedBy, `%${search}%`),
          ilike(medicalRecords.recordType, `%${search}%`),
          ilike(patients.firstName, `%${search}%`),
          ilike(patients.lastName, `%${search}%`),
          ilike(patients.patientId, `%${search}%`)
        )
      );
    }

    if (recordType) {
      conditions.push(eq(medicalRecords.recordType, recordType));
    }

    if (patientId) {
      conditions.push(eq(medicalRecords.patientId, patientId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const orderFn = order === "asc" ? asc : desc;

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(medicalRecords)
        .innerJoin(patients, eq(medicalRecords.patientId, patients.id))
        .where(whereClause),
      db
        .select({
          id: medicalRecords.id,
          recordType: medicalRecords.recordType,
          title: medicalRecords.title,
          description: medicalRecords.description,
          fileUrl: medicalRecords.fileUrl,
          recordedBy: medicalRecords.recordedBy,
          recordDate: medicalRecords.recordDate,
          createdAt: medicalRecords.createdAt,
          patientPk: patients.id,
          patientCode: patients.patientId,
          patientFirstName: patients.firstName,
          patientLastName: patients.lastName,
          patientDepartment: patients.department,
          patientStatus: patients.status,
        })
        .from(medicalRecords)
        .innerJoin(patients, eq(medicalRecords.patientId, patients.id))
        .where(whereClause)
        .orderBy(orderFn(medicalRecords.recordDate))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const data = rows.map((row) => ({
      id: row.id,
      recordType: row.recordType,
      title: row.title,
      description: row.description,
      fileUrl: row.fileUrl,
      recordedBy: row.recordedBy,
      recordDate: row.recordDate,
      createdAt: row.createdAt,
      patient: {
        id: row.patientPk,
        patientId: row.patientCode,
        firstName: row.patientFirstName,
        lastName: row.patientLastName,
        department: row.patientDepartment,
        status: row.patientStatus,
      },
    }));

    return NextResponse.json({
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch records:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

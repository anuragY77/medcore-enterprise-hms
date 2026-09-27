import { NextRequest, NextResponse } from "next/server";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/types/auth";
import { db, beds, patients } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";
import { bedSchema } from "@/lib/validations/bed";

const BED_SELECT = {
  id: beds.id,
  bedId: beds.bedId,
  roomNumber: beds.roomNumber,
  department: beds.department,
  ward: beds.ward,
  type: beds.type,
  status: beds.status,
  patientId: beds.patientId,
  createdAt: beds.createdAt,
  updatedAt: beds.updatedAt,
  patientName: sql<string | null>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
  patientNumber: patients.patientId,
};

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; message?: string };
  return e.code === "23505" || Boolean(e.message && e.message.includes("duplicate key"));
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "beds:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const department = searchParams.get("department") || "";
    const status = searchParams.get("status") || "All";
    const type = searchParams.get("type") || "All";
    const roomNumber = searchParams.get("roomNumber") || "";
    const patientId = searchParams.get("patientId") || "";
    const pagination = paginationSchema().safeParse({
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });

    if (!pagination.success) {
      return NextResponse.json(
        { error: "Validation failed", details: pagination.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    let patientFilter: string | null = null;
    if (patientId) {
      const uuidParsed = bedSchema.shape.patientId.safeParse(patientId);
      if (!uuidParsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: { patientId: ["Invalid patient ID"] } },
          { status: 400 }
        );
      }
      patientFilter = patientId;
    }

    const { page, pageSize } = pagination.data;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(beds.bedId, `%${query}%`),
          ilike(beds.roomNumber, `%${query}%`),
          ilike(beds.department, `%${query}%`),
          ilike(beds.ward, `%${query}%`)
        )
      );
    }

    if (department) {
      conditions.push(eq(beds.department, department));
    }

    if (status && status !== "All") {
      conditions.push(eq(beds.status, status));
    }

    if (type && type !== "All") {
      conditions.push(eq(beds.type, type));
    }

    if (roomNumber) {
      conditions.push(eq(beds.roomNumber, roomNumber));
    }

    if (patientFilter) {
      conditions.push(eq(beds.patientId, patientFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, bedsList] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(beds)
        .leftJoin(patients, eq(beds.patientId, patients.id))
        .where(whereClause),
      db
        .select(BED_SELECT)
        .from(beds)
        .leftJoin(patients, eq(beds.patientId, patients.id))
        .where(whereClause)
        .orderBy(sql`${beds.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      data: bedsList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch beds:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "beds:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Validation failed", details: { body: ["Invalid JSON"] } }, { status: 400 });
    }

    const parsed = bedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.status === "Occupied" && !data.patientId) {
      return NextResponse.json(
        { error: "Validation failed", details: { status: ["Occupied beds require a patient"] } },
        { status: 400 }
      );
    }
    if (data.patientId && data.status !== "Occupied") {
      return NextResponse.json(
        { error: "Validation failed", details: { patientId: ["Patient assignment requires status Occupied"] } },
        { status: 400 }
      );
    }

    if (data.patientId) {
      const result = await db.transaction(async (tx) => {
        const [patient] = await tx
          .select({ id: patients.id, status: patients.status })
          .from(patients)
          .where(eq(patients.id, data.patientId as string))
          .limit(1)
          .for("update");

        if (!patient) {
          return { status: 404, error: "Patient not found" };
        }
        if (patient.status === "Discharged") {
          return { status: 409, error: "Patient has been discharged" };
        }

        const [existing] = await tx
          .select({ id: beds.id })
          .from(beds)
          .where(eq(beds.patientId, data.patientId as string))
          .limit(1);

        if (existing) {
          return { status: 409, error: "Patient already occupies a bed" };
        }

        return { status: 0 };
      });

      if (result.status !== 0) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
    }

    let newBed = null;
    for (let attempt = 0; attempt < 5 && !newBed; attempt++) {
      const bedCount = await db.select({ count: sql<number>`count(*)` }).from(beds);
      const nextNumber = Number(bedCount[0]?.count ?? 0) + 1 + attempt;
      const bedId = `BED-${String(nextNumber).padStart(3, "0")}`;
      try {
        const [row] = await db
          .insert(beds)
          .values({
            bedId,
            roomNumber: data.roomNumber,
            department: data.department,
            ward: data.ward || null,
            type: data.type,
            status: data.status,
            patientId: data.patientId || null,
          })
          .returning();
        newBed = row;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 4) throw error;
      }
    }

    return NextResponse.json(newBed, { status: 201 });
  } catch (error) {
    console.error("Failed to create bed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

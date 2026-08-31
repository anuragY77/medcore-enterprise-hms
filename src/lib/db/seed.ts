import { drizzle } from "drizzle-orm/node-postgres";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const SEED_USERS = [
  {
    email: "admin@medcore.com",
    name: "Dr. Sarah Patel",
    role: "ADMIN",
    department: "Administration",
    avatar: "SP",
  },
  {
    email: "doctor@medcore.com",
    name: "Dr. James Wilson",
    role: "DOCTOR",
    department: "Cardiology",
    avatar: "JW",
  },
  {
    email: "nurse@medcore.com",
    name: "Nurse Emily Chen",
    role: "NURSE",
    department: "Emergency",
    avatar: "EC",
  },
  {
    email: "reception@medcore.com",
    name: "Maria Garcia",
    role: "RECEPTIONIST",
    department: "Front Desk",
    avatar: "MG",
  },
  {
    email: "pharmacy@medcore.com",
    name: "Pharm. David Kim",
    role: "PHARMACIST",
    department: "Pharmacy",
    avatar: "DK",
  },
];

const DEFAULT_PASSWORD = "medcore123";

async function seed() {
  const db = drizzle(process.env.DATABASE_URL!);
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  console.log("Seeding users...");

  for (const user of SEED_USERS) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          name: user.name,
          role: user.role,
          department: user.department,
          avatar: user.avatar,
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.email, user.email));
      console.log(`  Updated: ${user.email}`);
    } else {
      await db.insert(users).values({
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        avatar: user.avatar,
        password: hashedPassword,
      });
      console.log(`  Inserted: ${user.email}`);
    }
  }

  const count = await db.select().from(users);
  console.log(`\nSeeding complete. Total users: ${count.length}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

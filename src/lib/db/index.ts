import { drizzle } from "drizzle-orm/node-postgres";
import { users } from "./schema";

const db = drizzle(process.env.DATABASE_URL!);

export { db, users };

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { users } from "../lib/db/schema";

/**
 * Seeds two MVP users (no self-signup). Override credentials via env:
 *   SEED_SURVEYOR_EMAIL / SEED_SURVEYOR_PASSWORD
 *   SEED_SALES_EMAIL    / SEED_SALES_PASSWORD
 *
 * Run with: npm run db:seed
 */
async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL(_UNPOOLED) must be set");

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { casing: "snake_case" });

  const seedUsers = [
    {
      // Login is case-insensitive (the identifier is lowercased on sign-in).
      email: (process.env.SEED_SURVEYOR_EMAIL ?? "Elmechltd").toLowerCase(),
      password: process.env.SEED_SURVEYOR_PASSWORD ?? "Elmechltd123",
      name: process.env.SEED_SURVEYOR_NAME ?? "Elmechltd",
      role: "surveyor" as const,
    },
    {
      email: (process.env.SEED_SALES_EMAIL ?? "Elmechltd-sales").toLowerCase(),
      password: process.env.SEED_SALES_PASSWORD ?? "Elmechltd123",
      name: process.env.SEED_SALES_NAME ?? "Elmechltd Sales",
      role: "sales" as const,
    },
  ];

  for (const u of seedUsers) {
    const passwordHash = await hash(u.password);
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, u.email));

    if (existing.length > 0) {
      await db
        .update(users)
        .set({ passwordHash, name: u.name, role: u.role })
        .where(eq(users.email, u.email));
      console.log(`Updated ${u.role}: ${u.email}`);
    } else {
      await db.insert(users).values({
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
      });
      console.log(`Created ${u.role}: ${u.email}`);
    }
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

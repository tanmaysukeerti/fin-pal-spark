import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import * as t from "./schema";
import { buildDemoSeed, DEMO_USER_ID, DEMO_EMAIL, DEMO_PASSWORD } from "./seed-data";

/** Idempotent seed for the Neon database. Run: `npm run db:seed`. */
async function main() {
  const db = getDb();
  if (!db) {
    console.error("\n✗ DATABASE_URL is not set. Add your Neon connection string to .env first.\n");
    process.exit(1);
  }

  const seed = await buildDemoSeed();

  console.log("• Clearing existing demo account (cascades)…");
  await db.delete(t.users).where(eq(t.users.id, DEMO_USER_ID));

  console.log("• Inserting demo account…");
  await db.insert(t.users).values(seed.user);
  await db.insert(t.accounts).values(seed.accounts);
  await db.insert(t.transactions).values(seed.transactions);
  await db.insert(t.pods).values(seed.pods);
  await db.insert(t.podContributions).values(seed.contributions);
  await db.insert(t.goals).values(seed.goals);
  await db.insert(t.budgets).values(seed.budgets);
  await db.insert(t.achievements).values(seed.achievements);
  await db.insert(t.familyMembers).values(seed.family);
  await db.insert(t.allowances).values(seed.allowances);
  await db.insert(t.chores).values(seed.chores);
  if (seed.ledger.length) await db.insert(t.ledgerEntries).values(seed.ledger);

  console.log("\n✓ Seed complete.");
  console.log(`  Demo login →  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

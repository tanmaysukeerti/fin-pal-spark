import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Neon connection (server-only). Lazily initialised from process.env.DATABASE_URL.
 * When DATABASE_URL is absent the app falls back to the in-memory repo, so the
 * app is fully functional out of the box and becomes persistent the moment a
 * Neon connection string is provided.
 *
 * `.env` is loaded into process.env by `src/server.ts` (SSR entry), the seed
 * script, and drizzle.config.ts.
 */
export type Database = NeonHttpDatabase<typeof schema>;

let cached: Database | null | undefined;

export function getDb(): Database | null {
  if (cached !== undefined) return cached;
  const url =
    typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
  cached = url && url.length > 0 ? drizzle(neon(url), { schema }) : null;
  return cached;
}

export function hasDatabase(): boolean {
  return getDb() !== null;
}


import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Use DATABASE_URL from environment. 
// For Supabase, use the "Connection string" from settings.
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set. (Supabase Connection String)");
}

export const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false } // Required for Supabase/Railway connections
});
export const db = drizzle(pool, { schema });

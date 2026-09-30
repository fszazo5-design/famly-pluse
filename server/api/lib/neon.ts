/**
 * Neon database client — serverless-safe Postgres connection.
 *
 * Uses @neondatabase/serverless which works on Vercel Edge / Node runtimes
 * via HTTP transport (no persistent connection needed).
 *
 * Configure: use DATABASE_URL from the Neon Vercel integration.
 * NEON_DATABASE_URL remains supported as a legacy fallback.
 * Format: postgres://user:password@host/dbname?sslmode=require
 */

import { neon } from '@neondatabase/serverless';

// Vercel's Neon integration provides DATABASE_URL; retain the old name as a fallback.
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error('Set DATABASE_URL (or legacy NEON_DATABASE_URL) in Vercel project settings → Environment Variables.');
}

export const sql = neon(connectionString);

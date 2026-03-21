/**
 * Adds events.legacy_event_id + unique index if missing (fixes "column legacy_event_id does not exist").
 * Usage: from backend folder, `node scripts/ensure-legacy-event-id-column.mjs`
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const host = process.env.PG_HOST;
const user = process.env.PG_USER;
const database = process.env.PG_DATABASE;

if (!host || !user || !database) {
  console.error('Missing PG_HOST, PG_USER, or PG_DATABASE in .env');
  process.exit(1);
}

const pool = new pg.Pool({
  host,
  port: Number(process.env.PG_PORT || 5432),
  user,
  password: process.env.PG_PASSWORD || '',
  database,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const sql = `
ALTER TABLE events ADD COLUMN IF NOT EXISTS legacy_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_events_legacy_event_id ON events (legacy_event_id);
`;

try {
  await pool.query(sql);
  console.log('OK: events.legacy_event_id column and index are in place.');
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}

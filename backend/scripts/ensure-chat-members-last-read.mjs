/**
 * Adds chat_members.last_read_at for unread counts.
 * Usage: from repo root, `node backend/scripts/ensure-chat-members-last-read.mjs`
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

try {
  await pool.query('ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;');
  console.log('OK: chat_members.last_read_at is in place.');
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}

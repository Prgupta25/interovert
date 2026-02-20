import { Pool } from 'pg';
import env from './env.js';

let pool;

export function hasPostgresConfig() {
  return Boolean(env.pgHost && env.pgUser && env.pgDatabase);
}

export function getPgPool() {
  if (!hasPostgresConfig()) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      host: env.pgHost,
      port: env.pgPort,
      user: env.pgUser,
      password: env.pgPassword,
      database: env.pgDatabase,
      ssl: env.pgSsl ? { rejectUnauthorized: false } : false,
      max: 10,
    });
  }

  return pool;
}

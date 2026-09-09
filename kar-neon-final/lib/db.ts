import { Pool } from 'pg'

declare global {
  var __fowzanPool: Pool | undefined
}

export const pool = globalThis.__fowzanPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 5,
})

if (process.env.NODE_ENV !== 'production') globalThis.__fowzanPool = pool

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      sender_name TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      kept BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS responses (
      id BIGSERIAL PRIMARY KEY,
      message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Fowzan',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS messages_created_idx ON messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS responses_message_idx ON responses(message_id);
  `)
}

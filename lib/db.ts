import { Pool } from 'pg'

declare global {
  var __fowzanPool: Pool | undefined
  var __fowzanSchemaPromise: Promise<void> | undefined
}

const connectionString = process.env.STORAGE_DATABASE_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('No database connection string configured.')
}

export const pool = globalThis.__fowzanPool ?? new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
})

if (process.env.NODE_ENV !== 'production') globalThis.__fowzanPool = pool

export function ensureSchema() {
  if (globalThis.__fowzanSchemaPromise) return globalThis.__fowzanSchemaPromise

  const setup = pool.query(`
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
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS kept BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT 'Fowzan';
    CREATE INDEX IF NOT EXISTS messages_created_idx ON messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS responses_message_idx ON responses(message_id);
  `).then(() => undefined)

  globalThis.__fowzanSchemaPromise = setup.catch((error) => {
    globalThis.__fowzanSchemaPromise = undefined
    throw error
  })
  return globalThis.__fowzanSchemaPromise
}

import { Pool } from 'pg'
import { hashPassword } from '@/lib/password'

declare global {
  var __fowzanPool: Pool | undefined
  var __fowzanSchemaPromise: Promise<void> | undefined
}

const connectionString = process.env.STORAGE_DATABASE_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('No database connection string configured.')

export const pool = globalThis.__fowzanPool ?? new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 5 })
if (process.env.NODE_ENV !== 'production') globalThis.__fowzanPool = pool

async function seedUsers() {
  const ownerUsername = (process.env.OWNER_USERNAME || 'fowzan').trim().toLowerCase()
  const ownerDisplayName = process.env.OWNER_DISPLAY_NAME || 'Fowzan'
  const ownerPassword = process.env.OWNER_PASSWORD
  if (ownerPassword) {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [ownerUsername])
    if (!existing.rows[0]) {
      const passwordHash = await hashPassword(ownerPassword)
      await pool.query(`INSERT INTO users (username, display_name, password_hash, role) VALUES ($1,$2,$3,'owner')`, [ownerUsername, ownerDisplayName, passwordHash])
    }
  }

  const raw = process.env.INITIAL_USERS_JSON
  if (!raw) return
  let accounts: unknown
  try { accounts = JSON.parse(raw) } catch { throw new Error('INITIAL_USERS_JSON must be valid JSON.') }
  if (!Array.isArray(accounts)) throw new Error('INITIAL_USERS_JSON must be an array.')
  if (accounts.length > 50) throw new Error('INITIAL_USERS_JSON may contain at most 50 users.')
  for (const account of accounts) {
    const username = String((account as any)?.username ?? '').trim().toLowerCase()
    const password = String((account as any)?.password ?? '')
    const displayName = String((account as any)?.displayName ?? username).trim().slice(0, 80)
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 10) continue
    const exists = await pool.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username])
    if (exists.rows[0]) continue
    const passwordHash = await hashPassword(password)
    await pool.query(`INSERT INTO users (username, display_name, password_hash, role) VALUES ($1,$2,$3,'user')`, [username, displayName || username, passwordHash])
  }
}

export function ensureSchema() {
  if (globalThis.__fowzanSchemaPromise) return globalThis.__fowzanSchemaPromise
  const setup = pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner','user')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      sender_name TEXT,
      media_data TEXT,
      media_type TEXT,
      media_transcript TEXT,
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
      author_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      media_url TEXT,
      media_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS thread_votes (
      message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      voter_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (message_id, voter_key)
    );
    CREATE TABLE IF NOT EXISTS reply_votes (
      response_id BIGINT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      voter_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (response_id, voter_key)
    );
    CREATE TABLE IF NOT EXISTS polls (
      id BIGSERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      image_data TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS poll_votes (
      poll_id BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      option_index INTEGER NOT NULL,
      voter_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (poll_id, voter_key)
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      reset_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_data TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_transcript TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS kept BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT 'Fowzan';
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS author_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS media_url TEXT;
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS media_type TEXT;
    ALTER TABLE polls ADD COLUMN IF NOT EXISTS image_data TEXT;
    CREATE INDEX IF NOT EXISTS messages_user_created_idx ON messages(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS messages_created_idx ON messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS responses_message_idx ON responses(message_id);
    CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits(reset_at);
    CREATE INDEX IF NOT EXISTS polls_created_idx ON polls(created_at DESC);
    CREATE INDEX IF NOT EXISTS poll_votes_poll_idx ON poll_votes(poll_id);
    CREATE INDEX IF NOT EXISTS thread_votes_message_idx ON thread_votes(message_id);
    CREATE INDEX IF NOT EXISTS reply_votes_response_idx ON reply_votes(response_id);
  `).then(async () => {
    await seedUsers()
    const ownerUsername = (process.env.OWNER_USERNAME || 'fowzan').trim().toLowerCase()
    const owner = await pool.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [ownerUsername])
    if (owner.rows[0]) await pool.query('UPDATE messages SET user_id = $1 WHERE user_id IS NULL', [owner.rows[0].id])
  }).then(() => undefined)

  globalThis.__fowzanSchemaPromise = setup.catch((error) => { globalThis.__fowzanSchemaPromise = undefined; throw error })
  return globalThis.__fowzanSchemaPromise
}

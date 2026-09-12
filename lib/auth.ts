import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import { ensureSchema, pool } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

const SESSION_COOKIE = 'fowzan_session'
const SESSION_DAYS = 7

export type AuthUser = { id: number; username: string; displayName: string; role: 'owner' | 'user'; mustChangePassword: boolean }

function hashSession(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(user: AuthUser) {
  const token = randomBytes(32).toString('base64url')
  await pool.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')`, [hashSession(token), user.id])
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  })
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  await ensureSchema()
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const result = await pool.query(`
    SELECT u.id, u.username, u.display_name AS "displayName", u.role, u.must_change_password AS "mustChangePassword"
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.active = TRUE
    LIMIT 1
  `, [hashSession(token)])
  if (!result.rows[0]) return null
  return result.rows[0] as AuthUser
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

export async function isOwner() {
  const user = await getCurrentUser()
  return user?.role === 'owner'
}

export async function logout() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashSession(token)])
  store.delete(SESSION_COOKIE)
}

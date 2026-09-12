import { NextResponse } from 'next/server'
import { createSession, getCurrentUser } from '@/lib/auth'
import { ensureSchema, pool } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export async function POST(request: Request) {
  await ensureSchema()
  const body = await request.json().catch(() => ({}))
  const username = String(body.username ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 1) {
    return NextResponse.json({ error: 'Enter a valid username and password.' }, { status: 400 })
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const bucket = `login:${ip}:${username}`
  const limit = await pool.query(`INSERT INTO rate_limits (bucket, count, reset_at) VALUES ($1, 1, NOW() + INTERVAL '15 minutes') ON CONFLICT (bucket) DO UPDATE SET count = CASE WHEN rate_limits.reset_at < NOW() THEN 1 ELSE rate_limits.count + 1 END, reset_at = CASE WHEN rate_limits.reset_at < NOW() THEN NOW() + INTERVAL '15 minutes' ELSE rate_limits.reset_at END RETURNING count`, [bucket])
  if (Number(limit.rows[0].count) > 10) return NextResponse.json({ error: 'Too many sign-in attempts. Please wait 15 minutes.' }, { status: 429 })
  const result = await pool.query(`SELECT id, username, display_name AS "displayName", role, password_hash FROM users WHERE username = $1 AND active = TRUE LIMIT 1`, [username])
  const user = result.rows[0]
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 })
  }
  await createSession({ id: Number(user.id), username: user.username, displayName: user.displayName, role: user.role })
  return NextResponse.json({ ok: true, user: { username: user.username, displayName: user.displayName, role: user.role } })
}

export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json({ authenticated: Boolean(user), user: user ? { username: user.username, displayName: user.displayName, role: user.role } : null }, { headers: { 'Cache-Control': 'no-store' } })
}

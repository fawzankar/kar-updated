import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ensureSchema, pool } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'

export async function POST(request: Request) {
  await ensureSchema()
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')
  if (newPassword.length < 10) return NextResponse.json({ error: 'New password must be at least 10 characters.' }, { status: 400 })
  if (newPassword.length > 200) return NextResponse.json({ error: 'New password is too long.' }, { status: 400 })
  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1 AND active = TRUE', [user.id])
  if (!result.rows[0] || !(await verifyPassword(currentPassword, result.rows[0].password_hash))) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
  const passwordHash = await hashPassword(newPassword)
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id])
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id])
  return NextResponse.json({ ok: true, message: 'Password changed. Please sign in again.' })
}

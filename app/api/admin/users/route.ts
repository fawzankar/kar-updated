import { NextResponse } from 'next/server'
import { ensureSchema, pool } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { randomBytes } from 'node:crypto'

function clean(value: unknown, max: number) { return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max) }
function asId(value: unknown) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null }
async function owner() { const u = await getCurrentUser(); if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); if (u.role !== 'owner') return NextResponse.json({ error: 'Owner access required.' }, { status: 403 }); return null }

export async function GET() {
  await ensureSchema(); const denied = await owner(); if (denied) return denied
  const result = await pool.query(`SELECT u.id,u.username,u.display_name AS "displayName",u.role,u.active,u.created_at AS "createdAt",COUNT(m.id) FILTER (WHERE m.deleted_at IS NULL) AS "messageCount",COUNT(m.id) FILTER (WHERE m.deleted_at IS NULL AND m.is_read=FALSE) AS "unreadCount" FROM users u LEFT JOIN messages m ON m.user_id=u.id GROUP BY u.id ORDER BY CASE WHEN u.role='owner' THEN 0 ELSE 1 END,u.username ASC`)
  return NextResponse.json({ users: result.rows.map(u => ({ ...u, id:Number(u.id), messageCount:Number(u.messageCount), unreadCount:Number(u.unreadCount) })) }, { headers:{'Cache-Control':'no-store'} })
}

export async function PATCH(request: Request) {
  await ensureSchema(); const denied = await owner(); if (denied) return denied
  const body = await request.json().catch(() => ({})); const id=asId(body.id); const action=clean(body.action,40)
  if (!id) return NextResponse.json({ error:'Invalid user.' }, { status:400 })
  const target=await pool.query('SELECT id,username,display_name AS "displayName",role,active FROM users WHERE id=$1 LIMIT 1',[id])
  if (!target.rows[0]) return NextResponse.json({ error:'User not found.' }, { status:404 })
  if (target.rows[0].role==='owner') return NextResponse.json({ error:'The owner account cannot be managed here.' }, { status:400 })
  if (action==='toggle-active') { const active=!target.rows[0].active; await pool.query('UPDATE users SET active=$1 WHERE id=$2',[active,id]); if(!active) await pool.query('DELETE FROM sessions WHERE user_id=$1',[id]); return NextResponse.json({ok:true,active}) }
  if (action==='reset-password') { const password=`Fz-${randomBytes(12).toString('base64url')}`; await pool.query('UPDATE users SET password_hash=$1,active=TRUE WHERE id=$2',[await hashPassword(password),id]); await pool.query('DELETE FROM sessions WHERE user_id=$1',[id]); return NextResponse.json({ok:true,username:target.rows[0].username,password}) }
  return NextResponse.json({error:'Unknown action.'},{status:400})
}

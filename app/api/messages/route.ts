import { NextResponse } from 'next/server'
import { ensureSchema, pool } from '@/lib/db'
import { isOwner } from '@/lib/auth'

const MAX_MESSAGE = 500
const MAX_REPLY = 1000
const rateMap = new Map<string, { count: number; reset: number }>()

function rateLimit(request: Request, key: string) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  const bucket = rateMap.get(`${ip}:${key}`)
  if (!bucket || bucket.reset < now) {
    rateMap.set(`${ip}:${key}`, { count: 1, reset: now + 60_000 })
    return true
  }
  bucket.count += 1
  return bucket.count <= (key === 'message' ? 5 : 10)
}

function clean(value: unknown, max: number) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max)
}

export async function GET(request: Request) {
  await ensureSchema()
  const ownerView = new URL(request.url).searchParams.get('view') === 'owner'

  if (ownerView) {
    if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const messages = await pool.query(`SELECT id, text, sender_name AS "senderName", is_read, kept, created_at AS time FROM messages WHERE deleted_at IS NULL ORDER BY created_at DESC`)
    const replies = await pool.query(`SELECT id, message_id, text, author, created_at AS time FROM responses ORDER BY created_at ASC`)
    const grouped = new Map<number, any>()
    for (const m of messages.rows) {
      grouped.set(Number(m.id), { id: Number(m.id), text: m.text, senderName: m.senderName, unread: !m.is_read, kept: m.kept, time: m.time })
    }
    const publicMap = new Map<number, any>()
    for (const r of replies.rows) {
      const id = Number(r.message_id)
      const message = grouped.get(id)
      if (!message) continue
      if (!publicMap.has(id)) publicMap.set(id, { id, text: message.text, time: message.time, author: message.senderName || 'Anonymous', replies: [] })
      publicMap.get(id).replies.push({ id: Number(r.id), text: r.text, time: r.time, author: r.author })
    }
    return NextResponse.json({
      messages: [...grouped.values()],
      responses: [...publicMap.values()],
      answeredThoughtIds: [...publicMap.keys()],
    })
  }

  const result = await pool.query(`
    SELECT m.id, m.text, m.created_at AS time,
      COALESCE(json_agg(json_build_object('id', r.id, 'text', r.text, 'time', r.created_at, 'author', r.author) ORDER BY r.created_at ASC)
      FILTER (WHERE r.id IS NOT NULL), '[]') AS replies
    FROM messages m
    JOIN responses r ON r.message_id = m.id
    WHERE m.deleted_at IS NULL
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `)
  return NextResponse.json({
    responses: result.rows.map((r) => ({
      id: Number(r.id), text: r.text, time: r.time, author: 'Anonymous',
      replies: r.replies.map((x: any) => ({ ...x, id: Number(x.id) }))
    }))
  })
}

export async function POST(request: Request) {
  await ensureSchema()
  const body = await request.json().catch(() => ({}))
  const action = clean(body.action, 40)

  if (action === 'message' || action === 'public-reply') {
    if (!rateLimit(request, action === 'message' ? 'message' : 'reply')) {
      return NextResponse.json({ error: 'Too many submissions. Please wait a minute and try again.' }, { status: 429 })
    }
  }

  if (action === 'message') {
    const text = clean(body.text, MAX_MESSAGE)
    if (!text) return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 })
    const senderName = clean(body.senderName, 80) || null
    const result = await pool.query(`INSERT INTO messages (text, sender_name) VALUES ($1, $2) RETURNING id`, [text, senderName])
    return NextResponse.json({ ok: true, id: Number(result.rows[0].id) })
  }

  if (action === 'public-reply') {
    const messageId = Number(body.messageId)
    const text = clean(body.text, MAX_REPLY)
    if (!Number.isInteger(messageId) || !text) return NextResponse.json({ error: 'Invalid reply.' }, { status: 400 })
    const exists = await pool.query(`SELECT id FROM messages WHERE id = $1 AND deleted_at IS NULL`, [messageId])
    if (!exists.rows[0]) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 })
    await pool.query(`INSERT INTO responses (message_id, text, author) VALUES ($1, $2, $3)`, [messageId, text, clean(body.senderName, 80) || 'Anonymous'])
    return NextResponse.json({ ok: true })
  }

  if (action === 'owner-reply') {
    if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const messageId = Number(body.messageId)
    const text = clean(body.text, MAX_REPLY)
    if (!Number.isInteger(messageId) || !text) return NextResponse.json({ error: 'Invalid reply.' }, { status: 400 })
    const exists = await pool.query(`SELECT id FROM messages WHERE id = $1 AND deleted_at IS NULL`, [messageId])
    if (!exists.rows[0]) return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
    await pool.query(`INSERT INTO responses (message_id, text, author) VALUES ($1, $2, 'Fowzan')`, [messageId, text])
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}

export async function PATCH(request: Request) {
  await ensureSchema()
  if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const id = Number(body.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 })

  if (body.action === 'read') {
    await pool.query(`UPDATE messages SET is_read = TRUE WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'toggle-keep') {
    const result = await pool.query(`UPDATE messages SET kept = NOT kept WHERE id = $1 RETURNING kept`, [id])
    if (!result.rows[0]) return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, kept: result.rows[0].kept })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema()
    if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const threadId = Number(url.searchParams.get('id'))
    const responseId = Number(url.searchParams.get('responseId'))

    // Delete a single comment/reply.
    if (Number.isInteger(responseId)) {
      const result = await pool.query(`DELETE FROM responses WHERE id = $1 RETURNING id`, [responseId])
      if (!result.rows[0]) return NextResponse.json({ error: 'Reply not found.' }, { status: 404 })
      return NextResponse.json({ ok: true, deleted: 'reply' })
    }

    // Delete an entire thread. Hard-delete it so all child replies are removed
    // by the existing ON DELETE CASCADE relationship.
    if (!Number.isInteger(threadId)) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 })
    const result = await pool.query(`DELETE FROM messages WHERE id = $1 RETURNING id`, [threadId])
    if (!result.rows[0]) return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, deleted: 'thread' })
  } catch (error) {
    console.error('DELETE /api/messages failed:', error)
    return NextResponse.json({ error: 'Delete failed on the server.' }, { status: 500 })
  }
}

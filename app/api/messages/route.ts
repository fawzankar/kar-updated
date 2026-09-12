import { NextResponse } from 'next/server'
import { ensureSchema, pool } from '@/lib/db'
import { getCurrentUser, isOwner } from '@/lib/auth'

const MAX_MESSAGE = 500
const MAX_REPLY = 1000

async function rateLimit(request: Request, key: 'message' | 'reply' | 'vote') {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const bucket = `${ip}:${key}`
  const result = await pool.query(`
    INSERT INTO rate_limits (bucket, count, reset_at)
    VALUES ($1, 1, NOW() + INTERVAL '1 minute')
    ON CONFLICT (bucket) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at < NOW() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at < NOW() THEN NOW() + INTERVAL '1 minute' ELSE rate_limits.reset_at END
    RETURNING count
  `, [bucket])
  const maximum = key === 'message' ? 5 : key === 'reply' ? 10 : 20
  return Number(result.rows[0].count) <= maximum
}

function clean(value: unknown, max: number) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max)
}

function asId(value: unknown) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function cleanOptions(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string') return { text: clean(item, 120), imageData: null }
    const text = clean((item as any)?.text, 120)
    const imageData = cleanImageData((item as any)?.imageData)
    return { text, imageData }
  }).filter((item) => item.text).slice(0, 8)
}

function cleanImageData(value: unknown) {
  const candidate = clean(value, 3500000)
  if (!candidate) return null
  const match = candidate.match(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/)
  return match ? candidate : null
}

async function deletePoll(pollId: number) {
  const result = await pool.query(
    `UPDATE polls SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [pollId]
  )
  return Boolean(result.rows[0])
}

function cleanMediaUrl(value: unknown) {
  const candidate = clean(value, 2000)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch { return null }
}

function cleanAudioData(value: unknown) {
  const candidate = clean(value, 1200000)
  if (!candidate) return null
  const match = candidate.match(/^data:audio\/(webm|ogg|mp4|mpeg|wav)(?:;[^,]*)?;base64,[A-Za-z0-9+/=]+$/)
  return match ? candidate : null
}

export async function GET(request: Request) {
  await ensureSchema()
  const params = new URL(request.url).searchParams
  const ownerView = params.get('view') === 'owner'

  if (params.get('view') === 'thread') {
    const id = asId(params.get('id'))
    if (!id) return NextResponse.json({ error: 'Invalid thread.' }, { status: 400 })
    const threadUsername = (params.get('to') || process.env.OWNER_USERNAME || 'fowzan').trim().toLowerCase()
    const threadUser = await pool.query('SELECT id FROM users WHERE username = $1 AND active = TRUE LIMIT 1', [threadUsername])
    if (!threadUser.rows[0]) return NextResponse.json({ error: 'This thread is not available to share.' }, { status: 404 })
    const result = await pool.query(`
      SELECT m.id, m.text, m.sender_name AS "senderName", m.media_data AS "mediaData", m.media_type AS "mediaType", m.media_transcript AS "mediaTranscript", m.created_at AS time,
        COALESCE(json_agg(json_build_object('id', r.id, 'text', r.text, 'time', r.created_at, 'author', r.author, 'mediaUrl', r.media_url, 'mediaType', r.media_type, 'upvotes', (SELECT COUNT(*) FROM reply_votes rv WHERE rv.response_id = r.id)) ORDER BY r.created_at ASC, r.id ASC)
        FILTER (WHERE r.id IS NOT NULL), '[]') AS replies
      FROM messages m
      LEFT JOIN responses r ON r.message_id = m.id
      WHERE m.id = $1 AND m.user_id = $2 AND m.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM responses published WHERE published.message_id = m.id)
      GROUP BY m.id
    `, [id, threadUser.rows[0].id])
    if (!result.rows[0]) return NextResponse.json({ error: 'This thread is not available to share.' }, { status: 404 })
    const thread = result.rows[0]
    return NextResponse.json({ thread: { ...thread, id: Number(thread.id), mediaData: thread.mediaData ?? null, mediaType: thread.mediaType ?? null, replies: thread.replies.map((reply: any) => ({ ...reply, id: Number(reply.id) })) } }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (params.get('view') === 'poll') {
    const id = asId(params.get('id'))
    if (!id) return NextResponse.json({ error: 'Invalid poll.' }, { status: 400 })
    const result = await pool.query(`
      SELECT p.id, p.question, p.options, p.image_data AS "imageData", p.created_at AS time,
        COUNT(v.poll_id) AS total_votes,
        COALESCE(json_agg(json_build_object('optionIndex', v.option_index) ORDER BY v.option_index) FILTER (WHERE v.poll_id IS NOT NULL), '[]') AS votes
      FROM polls p LEFT JOIN poll_votes v ON v.poll_id = p.id
      WHERE p.id = $1 AND p.deleted_at IS NULL GROUP BY p.id
    `, [id])
    if (!result.rows[0]) return NextResponse.json({ error: 'This poll is not available to share.' }, { status: 404 })
    const poll = result.rows[0]
    const options = Array.isArray(poll.options) ? poll.options : []
    const counts = Array(options.length).fill(0)
    for (const vote of poll.votes ?? []) if (Number.isInteger(vote.optionIndex) && vote.optionIndex >= 0 && vote.optionIndex < counts.length) counts[vote.optionIndex]++
    return NextResponse.json({ poll: { id: Number(poll.id), question: poll.question, options, imageData: poll.imageData ?? null, counts, totalVotes: counts.reduce((a,b)=>a+b,0), time: poll.time } }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (ownerView) {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const messages = await pool.query(`
      SELECT id, text, sender_name AS "senderName", media_data AS "mediaData", media_type AS "mediaType", media_transcript AS "mediaTranscript", is_read, kept, created_at AS time,
        (SELECT COUNT(*) FROM thread_votes WHERE message_id = messages.id) AS upvotes
      FROM messages
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, [user.id])
    const polls = await pool.query(`
      SELECT p.id, p.question, p.options, p.image_data AS "imageData", p.created_at AS time, COUNT(v.poll_id) AS total_votes
      FROM polls p LEFT JOIN poll_votes v ON v.poll_id = p.id
      WHERE p.deleted_at IS NULL GROUP BY p.id ORDER BY p.created_at DESC
    `)
    const replies = await pool.query(`
      SELECT id, message_id, text, author, media_url AS "mediaUrl", media_type AS "mediaType", created_at AS time,
        (SELECT COUNT(*) FROM reply_votes WHERE response_id = responses.id) AS upvotes
      FROM responses
      WHERE message_id IS NOT NULL
      ORDER BY created_at ASC, id ASC
    `)

    const grouped = new Map<number, any>()
    for (const m of messages.rows) {
      grouped.set(Number(m.id), {
        id: Number(m.id),
        text: m.text,
        senderName: m.senderName,
        mediaData: m.mediaData ?? null,
        mediaType: m.mediaType ?? null,
        mediaTranscript: m.mediaTranscript ?? null,
        unread: !m.is_read,
        kept: m.kept,
        upvotes: Number(m.upvotes),
        time: m.time,
        replies: [],
      })
    }

    for (const r of replies.rows) {
      const message = grouped.get(Number(r.message_id))
      if (!message) continue
      message.replies.push({
        id: Number(r.id),
        text: r.text,
        time: r.time,
        author: r.author || 'Fowzan',
        mediaUrl: r.mediaUrl,
        mediaType: r.mediaType,
        upvotes: Number(r.upvotes ?? 0),
      })
    }

    const allMessages = [...grouped.values()]
    return NextResponse.json({
      messages: allMessages,
      responses: allMessages.filter((m) => m.replies.length > 0).map((m) => ({
        id: m.id,
        text: m.text,
        time: m.time,
        author: m.senderName || 'Anonymous',
        upvotes: m.upvotes,
        mediaData: m.mediaData ?? null,
        mediaType: m.mediaType ?? null,
        mediaTranscript: m.mediaTranscript ?? null,
        replies: m.replies,
      })),
      answeredThoughtIds: allMessages.filter((m) => m.replies.length > 0).map((m) => m.id),
      polls: polls.rows.map((p) => ({ id: Number(p.id), question: p.question, options: p.options, imageData: p.imageData ?? null, totalVotes: Number(p.total_votes), time: p.time })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const publicUsername = (params.get('to') || process.env.OWNER_USERNAME || 'fowzan').trim().toLowerCase()
  const publicUserResult = await pool.query('SELECT id FROM users WHERE username = $1 AND active = TRUE LIMIT 1', [publicUsername])
  const publicUserId = publicUserResult.rows[0]?.id
  if (!publicUserId) return NextResponse.json({ error: 'Inbox not found.' }, { status: 404 })

  const polls = await pool.query(`
    SELECT p.id, p.question, p.options, p.image_data AS "imageData", p.created_at AS time,
      COALESCE(json_agg(json_build_object('optionIndex', v.option_index, 'count', 1) ORDER BY v.option_index)
        FILTER (WHERE v.poll_id IS NOT NULL), '[]') AS votes
    FROM polls p
    LEFT JOIN poll_votes v ON v.poll_id = p.id
    WHERE p.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `)

  const result = await pool.query(`
    SELECT m.id, m.text, m.media_data AS "mediaData", m.media_type AS "mediaType", m.media_transcript AS "mediaTranscript", m.created_at AS time,
      (SELECT COUNT(*) FROM thread_votes WHERE message_id = m.id) AS upvotes,
      COALESCE(json_agg(json_build_object('id', r.id, 'text', r.text, 'time', r.created_at, 'author', r.author, 'mediaUrl', r.media_url, 'mediaType', r.media_type, 'upvotes', (SELECT COUNT(*) FROM reply_votes rv WHERE rv.response_id = r.id)) ORDER BY r.created_at ASC, r.id ASC)
      FILTER (WHERE r.id IS NOT NULL), '[]') AS replies
    FROM messages m
    LEFT JOIN responses r ON r.message_id = m.id
    WHERE m.user_id = $1 AND m.deleted_at IS NULL
    GROUP BY m.id
    HAVING COUNT(r.id) > 0
    ORDER BY m.created_at DESC
  `, [publicUserId])

  return NextResponse.json({
    responses: result.rows.map((r) => ({
      id: Number(r.id),
      text: r.text,
      mediaData: r.mediaData ?? null,
      mediaType: r.mediaType ?? null,
      mediaTranscript: r.mediaTranscript ?? null,
      time: r.time,
      author: 'Anonymous',
      upvotes: Number(r.upvotes),
      replies: r.replies.map((x: any) => ({ ...x, id: Number(x.id) })),
    })),
    polls: polls.rows.map((p) => {
      const options = Array.isArray(p.options) ? p.options : []
      const counts = Array(options.length).fill(0)
      for (const vote of p.votes ?? []) if (Number.isInteger(vote.optionIndex) && vote.optionIndex >= 0 && vote.optionIndex < counts.length) counts[vote.optionIndex]++
      return { id: Number(p.id), question: p.question, options, counts, totalVotes: counts.reduce((a, b) => a + b, 0), time: p.time }
    })
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  await ensureSchema()
  const body = await request.json().catch(() => ({}))
  const action = clean(body.action, 40)

  if (action === 'message' || action === 'public-reply' || action === 'toggle-upvote' || action === 'toggle-reply-upvote' || action === 'vote-poll') {
    const limitKey = action === 'message' ? 'message' : action === 'public-reply' ? 'reply' : 'vote'
    if (!(await rateLimit(request, limitKey))) {
      return NextResponse.json({ error: 'Too many submissions. Please wait a minute and try again.' }, { status: 429 })
    }
  }

  if (action === 'create-poll') {
    if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const question = clean(body.question, 240)
    const options = cleanOptions(body.options)
    if (!question || options.length < 2) return NextResponse.json({ error: 'Add a question and at least two options.' }, { status: 400 })
    const totalImageBytes = options.reduce((sum, option) => sum + (option.imageData ? option.imageData.length : 0), 0)
    if (totalImageBytes > 4000000) return NextResponse.json({ error: 'Please keep the combined poll images under 4 MB.' }, { status: 400 })
    const result = await pool.query(`INSERT INTO polls (question, options) VALUES ($1, $2::jsonb) RETURNING id`, [question, JSON.stringify(options)])
    return NextResponse.json({ ok: true, id: Number(result.rows[0].id) })
  }

  if (action === 'vote-poll') {
    const pollId = asId(body.pollId)
    const optionIndex = Number(body.optionIndex)
    const voterKey = clean(body.voterKey, 128)
    if (!pollId || !Number.isInteger(optionIndex) || optionIndex < 0 || voterKey.length < 16) return NextResponse.json({ error: 'Invalid poll vote.' }, { status: 400 })
    const poll = await pool.query(`SELECT options FROM polls WHERE id = $1 AND deleted_at IS NULL`, [pollId])
    if (!poll.rows[0] || !Array.isArray(poll.rows[0].options) || optionIndex >= poll.rows[0].options.length) return NextResponse.json({ error: 'Poll not found.' }, { status: 404 })
    await pool.query(`INSERT INTO poll_votes (poll_id, option_index, voter_key) VALUES ($1, $2, $3) ON CONFLICT (poll_id, voter_key) DO NOTHING`, [pollId, optionIndex, voterKey])
    const result = await pool.query(`SELECT option_index, COUNT(*) AS count FROM poll_votes WHERE poll_id = $1 GROUP BY option_index`, [pollId])
    const counts = Array(poll.rows[0].options.length).fill(0)
    for (const row of result.rows) counts[Number(row.option_index)] = Number(row.count)
    return NextResponse.json({ ok: true, counts, totalVotes: counts.reduce((a,b)=>a+b,0), voted: true })
  }

  if (action === 'message') {
  if (action === 'message') {
    const text = clean(body.text, MAX_MESSAGE)
    const senderName = clean(body.senderName, 80) || null
    const mediaCandidate = clean(body.mediaData, 1500000)
    const mediaType = body.mediaType === 'image' ? 'image' : body.mediaType === 'audio' ? 'audio' : null
    const mediaTranscript = mediaType === 'audio' ? clean(body.mediaTranscript, 1200) || null : null
    if (!text && !mediaCandidate) return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 })
    if (mediaCandidate) {
      const imagePrefix = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/
      const audioPrefix = /^data:audio\/(webm|ogg|mp4|mpeg|wav)(?:;[^,]*)?;base64,[A-Za-z0-9+/=]+$/
      const valid = mediaType === 'image' ? imagePrefix.test(mediaCandidate) : mediaType === 'audio' ? audioPrefix.test(mediaCandidate) : false
      if (!valid) return NextResponse.json({ error: 'Invalid attachment.' }, { status: 400 })
      if (mediaCandidate.length > 1450000) return NextResponse.json({ error: 'Attachment is too large. Please use a smaller photo or shorter voice note.' }, { status: 400 })
    }
    const recipient = clean(body.recipient, 32).toLowerCase() || (process.env.OWNER_USERNAME || 'fowzan').toLowerCase()
    const recipientResult = await pool.query('SELECT id FROM users WHERE username = $1 AND active = TRUE LIMIT 1', [recipient])
    if (!recipientResult.rows[0]) return NextResponse.json({ error: 'That inbox does not exist.' }, { status: 404 })
    const result = await pool.query(
      `INSERT INTO messages (user_id, text, sender_name, media_data, media_type, media_transcript) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [recipientResult.rows[0].id, text, senderName, mediaCandidate || null, mediaCandidate ? mediaType : null, mediaTranscript]
    )
    return NextResponse.json({ ok: true, id: Number(result.rows[0].id) })
  }
  }

  if (action === 'public-reply') {
    const messageId = asId(body.messageId)
    const text = clean(body.text, MAX_REPLY)
    if (!messageId || !text) return NextResponse.json({ error: 'Invalid reply.' }, { status: 400 })
    const exists = await pool.query(`SELECT id FROM messages WHERE id = $1 AND deleted_at IS NULL`, [messageId])
    if (!exists.rows[0]) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 })
    await pool.query(
      `INSERT INTO responses (message_id, text, author) VALUES ($1, $2, $3)`,
      [messageId, text, clean(body.senderName, 80) || 'Anonymous']
    )
    return NextResponse.json({ ok: true })
  }

  if (action === 'owner-reply') {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const messageId = asId(body.messageId)
    const text = clean(body.text, MAX_REPLY)
    const rawMedia = clean(body.mediaUrl, 1200000)
    const audioData = body.mediaType === 'audio' ? cleanAudioData(rawMedia) : null
    const mediaUrl = body.mediaType === 'audio' ? audioData : cleanMediaUrl(rawMedia)
    const mediaType = body.mediaType === 'audio' ? 'audio' : body.mediaType === 'gif' ? 'gif' : body.mediaType === 'image' ? 'image' : null
    if (!messageId || (!text && !mediaUrl)) return NextResponse.json({ error: 'Write a reply or add a voice note, image or GIF.' }, { status: 400 })
    if (body.mediaType === 'audio' && !audioData) return NextResponse.json({ error: 'Invalid voice note.' }, { status: 400 })
    if (body.mediaType !== 'audio' && rawMedia && !mediaUrl) return NextResponse.json({ error: 'Use a valid http(s) image or GIF URL.' }, { status: 400 })
    const exists = await pool.query(`SELECT id FROM messages WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [messageId, user.id])
    if (!exists.rows[0]) return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
    await pool.query(`INSERT INTO responses (message_id, text, author, author_user_id, media_url, media_type) VALUES ($1, $2, $3, $4, $5, $6)`, [messageId, text, user.displayName, user.id, mediaUrl, mediaUrl ? mediaType || 'image' : null])
    return NextResponse.json({ ok: true })
  }

  if (action === 'toggle-reply-upvote') {
    const responseId = asId(body.responseId)
    const voterKey = clean(body.voterKey, 128)
    if (!responseId || voterKey.length < 16) return NextResponse.json({ error: 'Invalid reply vote.' }, { status: 400 })
    const exists = await pool.query(`SELECT r.id FROM responses r JOIN messages m ON m.id = r.message_id WHERE r.id = $1 AND m.deleted_at IS NULL`, [responseId])
    if (!exists.rows[0]) return NextResponse.json({ error: 'Reply not found.' }, { status: 404 })
    const current = await pool.query(`SELECT 1 FROM reply_votes WHERE response_id = $1 AND voter_key = $2`, [responseId, voterKey])
    const voted = !current.rows[0]
    if (voted) await pool.query(`INSERT INTO reply_votes (response_id, voter_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [responseId, voterKey])
    else await pool.query(`DELETE FROM reply_votes WHERE response_id = $1 AND voter_key = $2`, [responseId, voterKey])
    const count = await pool.query(`SELECT COUNT(*) AS upvotes FROM reply_votes WHERE response_id = $1`, [responseId])
    return NextResponse.json({ ok: true, voted, upvotes: Number(count.rows[0].upvotes) })
  }

  if (action === 'toggle-upvote') {
    const messageId = asId(body.messageId)
    const voterKey = clean(body.voterKey, 128)
    if (!messageId || voterKey.length < 16) return NextResponse.json({ error: 'Invalid vote.' }, { status: 400 })
    const exists = await pool.query(`SELECT id FROM messages WHERE id = $1 AND deleted_at IS NULL`, [messageId])
    if (!exists.rows[0]) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 })
    const current = await pool.query(`SELECT 1 FROM thread_votes WHERE message_id = $1 AND voter_key = $2`, [messageId, voterKey])
    const voted = !current.rows[0]
    if (voted) await pool.query(`INSERT INTO thread_votes (message_id, voter_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [messageId, voterKey])
    else await pool.query(`DELETE FROM thread_votes WHERE message_id = $1 AND voter_key = $2`, [messageId, voterKey])
    const count = await pool.query(`SELECT COUNT(*) AS upvotes FROM thread_votes WHERE message_id = $1`, [messageId])
    return NextResponse.json({ ok: true, voted, upvotes: Number(count.rows[0].upvotes) })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}

export async function PATCH(request: Request) {
  await ensureSchema()
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const id = asId(body.id)
  if (!id) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 })

  if (body.action === 'read') {
    await pool.query(`UPDATE messages SET is_read = TRUE WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [id, user.id])
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'toggle-keep') {
    const result = await pool.query(`UPDATE messages SET kept = NOT kept WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING kept`, [id, user.id])
    if (!result.rows[0]) return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, kept: result.rows[0].kept })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}

export async function DELETE(request: Request) {
  await ensureSchema()
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const type = params.get('type') || 'thread'
  const id = asId(params.get('id'))

  if (!id) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })

  if (type === "poll") {
      if (user.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      const pollId = Number(id)
      if (!Number.isSafeInteger(pollId)) return NextResponse.json({ error: "Invalid poll id." }, { status: 400 })
      const deleted = await deletePoll(pollId)
      if (!deleted) return NextResponse.json({ error: "Poll not found." }, { status: 404 })
      return NextResponse.json({ ok: true })
    }

    if (type === 'reply') {
    const messageId = asId(params.get('messageId'))
    if (!messageId) return NextResponse.json({ error: 'Invalid thread id.' }, { status: 400 })
    const result = await pool.query(`DELETE FROM responses WHERE id = $1 AND message_id = $2 AND EXISTS (SELECT 1 FROM messages WHERE id = $2 AND user_id = $3) RETURNING id`, [id, messageId, user.id])
    if (!result.rows[0]) return NextResponse.json({ error: 'Reply not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, deleted: 'reply' })
  }

  if (type !== 'thread') return NextResponse.json({ error: 'Invalid delete type.' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const message = await client.query(`SELECT id FROM messages WHERE id = $1 AND user_id = $2`, [id, user.id])
    if (!message.rows[0]) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Thread not found.' }, { status: 404 })
    }
    await client.query(`DELETE FROM responses WHERE message_id = $1`, [id])
    await client.query(`DELETE FROM messages WHERE id = $1`, [id])
    await client.query('COMMIT')
    return NextResponse.json({ ok: true, deleted: 'thread' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Thread deletion failed:', error)
    return NextResponse.json({ error: 'Could not delete the thread.' }, { status: 500 })
  } finally {
    client.release()
  }
}

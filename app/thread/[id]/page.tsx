import Link from 'next/link'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { ensureSchema, pool } from '@/lib/db'
import ShareThreadButton from './ShareThreadButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Reply = { id: number; text: string; time: string; author: string; mediaUrl?: string | null; mediaType?: 'image' | 'gif' | 'audio' | null }
type Thread = { id: number; text: string; senderName?: string | null; time: string; mediaData?: string | null; mediaType?: 'image' | 'audio' | null; mediaTranscript?: string | null; replies: Reply[] }

function displayTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function asId(value: string) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

async function getThread(idValue: string): Promise<Thread | null> {
  const id = asId(idValue)
  if (!id) return null

  await ensureSchema()
  const result = await pool.query(`
    SELECT m.id, m.text, m.sender_name AS "senderName", m.media_data AS "mediaData", m.media_type AS "mediaType", m.media_transcript AS "mediaTranscript", m.created_at AS time,
      COALESCE(json_agg(json_build_object(
        'id', r.id,
        'text', r.text,
        'time', r.created_at,
        'author', r.author,
        'mediaUrl', r.media_url,
        'mediaType', r.media_type,
        'upvotes', (SELECT COUNT(*) FROM reply_votes rv WHERE rv.response_id = r.id)
      ) ORDER BY r.created_at ASC, r.id ASC) FILTER (WHERE r.id IS NOT NULL), '[]') AS replies
    FROM messages m
    LEFT JOIN responses r ON r.message_id = m.id
    WHERE m.id = $1
      AND m.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM responses published
        WHERE published.message_id = m.id AND published.author = 'Fowzan'
      )
    GROUP BY m.id
  `, [id])

  if (!result.rows[0]) return null
  const row = result.rows[0]
  return {
    id: Number(row.id),
    text: row.text,
    senderName: row.senderName ?? null,
    time: row.time,
    mediaData: row.mediaData ?? null,
    mediaType: row.mediaType ?? null,
    mediaTranscript: row.mediaTranscript ?? null,
    replies: (row.replies ?? []).map((reply: any) => ({
      ...reply,
      id: Number(reply.id),
      upvotes: Number(reply.upvotes ?? 0),
    })),
  }
}

export default async function SharedThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let thread: Thread | null = null
  let error = ''

  try {
    thread = await getThread(id)
    if (!thread) error = 'This thread is not available to share.'
  } catch {
    error = 'This thread could not be loaded right now.'
  }

  return <main className="shared-thread-page" data-theme="purple" data-mode="gamer">
    <div className="shared-thread-grid" aria-hidden="true" />
    <section className="shared-thread-shell">
      <Link href="/" className="shared-thread-back"><ArrowLeft size={15} /> Fowzan&apos;s Inbox</Link>
      {error && <div className="shared-thread-card"><MessageCircle size={24} /><h1>Thread unavailable</h1><p>{error}</p><Link href="/" className="primary-button">Visit the inbox</Link></div>}
      {thread && <article className="shared-thread-card">
        <div className="shared-thread-kicker"><span /> SHARED CONVERSATION <ShareThreadButton /></div>
        <h1>{thread.senderName || 'Anonymous'}</h1>
        <p className="shared-thread-date">Started {displayTime(thread.time)}</p>
        <div className="shared-thread-messages">
          <div className="shared-message">
            <b>{thread.senderName || 'Anonymous'}</b>
            {thread.mediaData && (thread.mediaType === 'image' ? <img className="message-media-image" src={thread.mediaData} alt="Attachment" /> : <><audio className="message-media-audio" controls preload="metadata" src={thread.mediaData} />{thread.mediaTranscript && <div className="thread-transcript"><span>WORDS</span>{thread.mediaTranscript}</div>}</>)}
            {thread.text && <p>{thread.text}</p>}
          </div>
          {thread.replies.map((reply) => <div key={reply.id} className={`shared-message ${reply.author === 'Fowzan' ? 'from-owner' : ''}`}>
            <b>{reply.author}</b>
            {reply.mediaUrl && (reply.mediaType === 'audio' ? <div className="reply-voice-card"><span>VOICE NOTE</span><audio controls preload="metadata" src={reply.mediaUrl} /></div> : <a className="reply-media" href={reply.mediaUrl} target="_blank" rel="noreferrer"><img src={reply.mediaUrl} alt={reply.mediaType === 'gif' ? 'GIF attached by Fowzan' : 'Image attached by Fowzan'} loading="lazy" decoding="async" /></a>)}
            {reply.text && <p>{reply.text}</p>}
          </div>)}
        </div>
      </article>}
    </section>
  </main>
}

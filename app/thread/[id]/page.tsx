'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, MessageCircle, Share2 } from 'lucide-react'

type Reply = { id: number; text: string; time: string; author: string; mediaUrl?: string | null; mediaType?: 'image' | 'gif' | null }
type Thread = { id: number; text: string; senderName?: string | null; time: string; mediaData?: string | null; mediaType?: 'image' | 'audio' | null; mediaTranscript?: string | null; replies: Reply[] }

function displayTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export default function SharedThreadPage() {
  const { id } = useParams<{ id: string }>()
  const [thread, setThread] = useState<Thread | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/messages?view=thread&id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'This thread could not be found.')
        setThread(data.thread)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'This thread could not be found.'))
  }, [id])

  async function share() {
    const url = window.location.href
    if (navigator.share) await navigator.share({ title: "A thread from Fowzan's Inbox", url })
    else await navigator.clipboard.writeText(url)
  }

  return <main className="shared-thread-page">
    <div className="shared-thread-grid" aria-hidden="true" />
    <section className="shared-thread-shell">
      <Link href="/" className="shared-thread-back"><ArrowLeft size={15} /> Fowzan&apos;s Inbox</Link>
      {!thread && !error && <div className="shared-thread-loading"><Loader2 className="spin" size={20} /> opening thread…</div>}
      {error && <div className="shared-thread-card"><MessageCircle size={24} /><h1>Thread unavailable</h1><p>{error}</p><Link href="/" className="primary-button">Visit the inbox</Link></div>}
      {thread && <article className="shared-thread-card">
        <div className="shared-thread-kicker"><span /> SHARED CONVERSATION <button onClick={share} aria-label="Share this thread"><Share2 size={15} /></button></div>
        <h1>{thread.senderName || 'Anonymous'}</h1>
        <p className="shared-thread-date">Started {displayTime(thread.time)}</p>
        <div className="shared-thread-messages">
          <div className="shared-message"><b>{thread.senderName || 'Anonymous'}</b>{thread.mediaData && (thread.mediaType === 'image' ? <img className="message-media-image" src={thread.mediaData} alt="Attachment" /> : <div className="message-audio-card"><audio className="message-media-audio" controls src={thread.mediaData} />{thread.mediaTranscript && <p className="audio-transcript">{thread.mediaTranscript}</p>}</div>)}{thread.text && <p>{thread.text}</p>}</div>
          {thread.replies.map((reply) => <div key={reply.id} className={`shared-message ${reply.author === 'Fowzan' ? 'from-owner' : ''}`}><b>{reply.author}</b>{reply.mediaUrl && <a className="reply-media" href={reply.mediaUrl} target="_blank" rel="noreferrer"><img src={reply.mediaUrl} alt={reply.mediaType === 'gif' ? 'GIF attached by Fowzan' : 'Image attached by Fowzan'} loading="lazy" decoding="async" /></a>}{reply.text && <p>{reply.text}</p>}</div>)}
        </div>
      </article>}
    </section>
  </main>
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Check, Eye, LockKeyhole, Mail, MessageCircle, PenLine,
  Share2, Sparkles, Star, X, LogOut, Loader2, ShieldCheck
} from 'lucide-react'

type ThreadReply = {
  id: number
  text: string
  time: string
  author: string
}

type Thought = {
  id: number
  text: string
  time: string
  unread?: boolean
  kept?: boolean
  senderName?: string | null
  replies: ThreadReply[]
}

type PublicResponse = {
  id: number
  text: string
  time: string
  author: string
  replies: { id: number; text: string; time: string; author: string }[]
}

const prompts = [
  'How are you doing today?',
  'What do you do?',
  'What are you into right now?',
  'What are you looking forward to?',
  'What is your favourite thing lately?',
  'Ask me anything.'
]

const emptyResponses: PublicResponse[] = []

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((date.getTime() - Date.now()) / 86400000),
    'day'
  )
}

export default function Page() {
  const [view, setView] = useState<'public' | 'private'>('public')
  const [thought, setThought] = useState('')
  const [sent, setSent] = useState(false)
  const [senderName, setSenderName] = useState('')
  const [revealName, setRevealName] = useState(false)
  const [copied, setCopied] = useState(false)
  const [ownerUnlocked, setOwnerUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [selected, setSelected] = useState<Thought | null>(null)
  const [showKeeps, setShowKeeps] = useState(false)
  const [shareCard, setShareCard] = useState<Thought | null>(null)
  const [responses, setResponses] = useState<PublicResponse[]>(emptyResponses)
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyName, setReplyName] = useState('')
  const [replyReveal, setReplyReveal] = useState(false)
  const [ownerReplies, setOwnerReplies] = useState<Record<number, string>>({})
  const [answeredThoughtIds, setAnsweredThoughtIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [replySending, setReplySending] = useState<number | null>(null)
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)

  const visibleThoughts = useMemo(
    () => showKeeps ? thoughts.filter((item) => item.kept) : thoughts,
    [showKeeps, thoughts]
  )
  const unreadCount = thoughts.filter((item) => item.unread).length

  async function loadPublic() {
    try {
      const response = await fetch('/api/messages?view=public', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load the public page.')
      const data = await response.json()
      setResponses(data.responses ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the page.')
    } finally {
      setLoading(false)
    }
  }

  async function loadOwner() {
    const response = await fetch('/api/messages?view=owner', { cache: 'no-store' })
    if (response.status === 401) {
      setOwnerUnlocked(false)
      return
    }
    if (!response.ok) throw new Error('Could not load your inbox.')
    const data = await response.json()
    const nextMessages: Thought[] = data.messages ?? []
    setThoughts(nextMessages)
    setResponses(data.responses ?? [])
    setAnsweredThoughtIds(data.answeredThoughtIds ?? [])
    setSelected((current) => current ? nextMessages.find((item) => item.id === current.id) ?? null : null)
  }

  useEffect(() => {
    loadPublic()
  }, [])

  useEffect(() => {
    if (view !== 'private' || !ownerUnlocked) return
    const timer = window.setInterval(() => {
      loadOwner().catch((err) => setError(err instanceof Error ? err.message : 'Could not refresh your inbox.'))
    }, 10000)
    return () => window.clearInterval(timer)
  }, [view, ownerUnlocked])

  async function submitThought() {
    const text = thought.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          text,
          senderName: revealName ? senderName.trim() : null
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not send your message.')
      setThought('')
      setSenderName('')
      setRevealName(false)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  async function submitReply(id: number) {
    const text = replyText.trim()
    if (!text) return
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'public-reply',
          messageId: id,
          text,
          senderName: replyReveal ? replyName.trim() : null
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not post your reply.')
      setReplyText('')
      setReplyName('')
      setReplyReveal(false)
      setReplyingTo(null)
      await loadPublic()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your reply.')
    }
  }

  async function submitOwnerReply(id: number) {
    const text = ownerReplies[id]?.trim()
    if (!text || replySending === id) return
    setReplySending(id)
    setError('')
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'owner-reply', messageId: id, text })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not post the reply.')
      setOwnerReplies((current) => ({ ...current, [id]: '' }))
      await loadOwner()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the reply.')
    } finally {
      setReplySending(null)
    }
  }

  async function deleteThought(id: number) {
    if (deleteBusy) return
    setDeleteBusy(`thread-${id}`)
    setError('')
    try {
      const response = await fetch(`/api/messages?id=${id}&type=thread`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not delete the thread.')
      setThoughts((current) => current.filter((item) => item.id !== id))
      setSelected(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the thread.')
    } finally {
      setDeleteBusy(null)
    }
  }

  async function deleteReply(messageId: number, replyId: number) {
    if (deleteBusy) return
    setDeleteBusy(`reply-${replyId}`)
    setError('')
    try {
      const response = await fetch(`/api/messages?id=${replyId}&type=reply`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not delete the reply.')
      setThoughts((current) => current.map((item) => item.id === messageId ? { ...item, replies: item.replies.filter((reply) => reply.id !== replyId) } : item))
      setSelected((current) => current && current.id === messageId ? { ...current, replies: current.replies.filter((reply) => reply.id !== replyId) } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the reply.')
    } finally {
      setDeleteBusy(null)
    }
  }

  async function toggleKeep(id: number) {
    try {
      const response = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggle-keep' })
      })
      if (!response.ok) throw new Error('Could not update the message.')
      const data = await response.json()
      setThoughts((current) => current.map((entry) => entry.id === id ? { ...entry, kept: data.kept } : entry))
      setSelected((current) => current?.id === id ? { ...current, kept: data.kept } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the message.')
    }
  }

  async function sharePage() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: "Fowzan's inbox", text: "Leave Fowzan a message.", url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      }
    } catch {
      setCopied(false)
    }
  }

  async function unlock(event: React.FormEvent) {
    event.preventDefault()
    setLoginError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Invalid password.')
      setOwnerUnlocked(true)
      setPassword('')
      await loadOwner()
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to sign in.')
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setOwnerUnlocked(false)
    setView('public')
    setThoughts([])
  }

  function openThought(item: Thought) {
    setSelected(item)
    if (item.unread) {
      setThoughts((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))
      fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'read' })
      }).catch(() => {})
    }
  }

  if (view === 'private' && !ownerUnlocked) return (
    <main className="funky-page min-h-screen px-5 py-6 text-foreground sm:px-8">
      <button className="back-button" onClick={() => setView('public')} aria-label="Back to public page">
        <ArrowLeft size={16} /> back to public page
      </button>
      <section className="mx-auto flex min-h-[82vh] max-w-md flex-col justify-center">
        <div className="secret-sticker"><ShieldCheck size={14} /> private inbox</div>
        <h1 className="display-title mt-6">Your<br /><span>inbox.</span></h1>
        <p className="mt-6 max-w-xs text-sm leading-6 text-muted-foreground">A private space for every anonymous thread. Authentication is handled on the server.</p>
        <form onSubmit={unlock} className="mt-9 space-y-3">
          <label className="sr-only" htmlFor="owner-password">Owner password</label>
          <input id="owner-password" autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="enter your password" className="funky-input" autoComplete="current-password" />
          {loginError && <p className="text-xs text-accent" role="alert">{loginError}</p>}
          <button className="funky-button w-full" type="submit" disabled={!password.trim()}>Sign in <ArrowLeft className="rotate-180" size={16} /></button>
        </form>
      </section>
    </main>
  )

  if (view === 'private') return (
    <main className="funky-page min-h-screen px-4 py-5 text-foreground sm:px-6">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <button className="back-button" onClick={() => setView('public')}><ArrowLeft size={16} /> back to signal</button>
        <div className="flex items-center gap-2">
          <button className="keep-filter" onClick={() => setShowKeeps(!showKeeps)}><Star size={15} fill={showKeeps ? 'currentColor' : 'none'} /> {showKeeps ? 'all threads' : 'saved signals'}</button>
          <button className="keep-filter" onClick={logout}><LogOut size={15} /> exit inbox</button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl pb-8 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3"><div className="secret-sticker"><Mail size={14} /> private channel</div><span className="soft-pill">{unreadCount} unread</span></div>
            <h1 className="display-title mt-5 text-[3.2rem] sm:text-7xl">Your<br /><span>signals.</span></h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Everything lands here. Open a signal, reply as yourself, and manage each conversation on your terms.</p>
          </div>
          <button className="share-icon" onClick={sharePage} aria-label="Share anonymous inbox"><Share2 size={17} /></button>
        </div>

        {error && <div className="error-banner mt-6" role="alert">{error}</div>}

        <div className="inbox-layout mt-8">
          <aside className="inbox-sidebar">
            <div className="flex items-center justify-between gap-3">
              <div><div className="section-kicker"><MessageCircle size={14} /> signal list</div><p className="mt-1 text-xs text-muted-foreground">{visibleThoughts.length} conversations</p></div>
              <span className="soft-pill">online</span>
            </div>
            <div className="thread-list mt-4">
              {visibleThoughts.map((item) => (
                <button key={item.id} onClick={() => openThought(item)} className={`thread-list-card ${selected?.id === item.id ? 'thread-list-card-active' : ''}`}>
                  <div className="flex items-center justify-between gap-3"><span className="thread-author truncate">{item.senderName || 'Anonymous'}</span>{item.unread && <span className="new-label">new</span>}</div>
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-foreground/90">{item.text}</p>
                  <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.13em] text-muted-foreground"><span>{item.replies.length} {item.replies.length === 1 ? 'reply' : 'replies'}</span><span>{formatTime(item.time)}</span></div>
                </button>
              ))}
              {!visibleThoughts.length && <div className="empty-note">{showKeeps ? 'Nothing kept here yet.' : 'Your inbox is empty.'}</div>}
            </div>
          </aside>

          <section className="thread-workspace">
            {!selected ? (
              <div className="thread-placeholder"><MessageCircle size={22} /><h2>Pick a signal</h2><p>Choose a message on the left to open the conversation.</p></div>
            ) : (
              <div className="thread-panel">
                <div className="thread-panel-header">
                  <div className="min-w-0"><div className="section-kicker"><span className="h-2 w-2 rounded-full bg-punch" /> signal</div><h2 className="mt-2 truncate font-serif text-2xl sm:text-3xl">{selected.senderName || 'Anonymous'}</h2><p className="mt-1 text-xs text-muted-foreground">{selected.replies.length} {selected.replies.length === 1 ? 'reply' : 'replies'} · {formatTime(selected.time)}</p></div>
                  <button className="small-action" onClick={() => deleteThought(selected.id)} disabled={deleteBusy === `thread-${selected.id}`}><X size={14} /> {deleteBusy === `thread-${selected.id}` ? 'deleting…' : 'remove signal'}</button>
                </div>

                <div className="thread-scroll">
                  <article className="thread-message original-message">
                    <div className="thread-message-meta"><span>{selected.senderName || 'Anonymous'}</span><span>{formatTime(selected.time)}</span></div>
                    <p>{selected.text}</p>
                    <button className="thread-delete" onClick={() => deleteThought(selected.id)} disabled={deleteBusy === `thread-${selected.id}`}><X size={12} /> remove signal</button>
                  </article>

                  {selected.replies.map((reply) => (
                    <article key={reply.id} className={`thread-message ${reply.author === 'Fowzan' ? 'owner-message' : ''}`}>
                      <div className="thread-message-meta"><span>{reply.author}</span><span>{formatTime(reply.time)}</span></div>
                      <p>{reply.text}</p>
                      <button className="thread-delete" onClick={() => deleteReply(selected.id, reply.id)} disabled={deleteBusy === `reply-${reply.id}`}><X size={12} /> {deleteBusy === `reply-${reply.id}` ? 'deleting…' : 'delete'}</button>
                    </article>
                  ))}
                </div>

                <div className="thread-reply-box">
                  <div className="reply-form">
                    <input value={ownerReplies[selected.id] ?? ''} onChange={(event) => setOwnerReplies((current) => ({ ...current, [selected.id]: event.target.value }))} placeholder="write a reply..." aria-label="Reply as Fowzan" maxLength={1000} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitOwnerReply(selected.id) } }} />
                    <button onClick={() => submitOwnerReply(selected.id)} disabled={!ownerReplies[selected.id]?.trim() || replySending === selected.id} aria-label="Send reply">{replySending === selected.id ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeft className="rotate-180" size={16} />}</button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.13em] text-muted-foreground"><span>reply from your inbox</span><span>{(ownerReplies[selected.id] ?? '').length}/1000</span></div>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="reply-queue-panel mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="section-kicker"><PenLine size={14} /> reply queue</div><p className="mt-2 text-sm text-muted-foreground">Signals waiting for a response.</p></div><span className="soft-pill">{thoughts.filter((item) => item.replies.length === 0).length} waiting</span></div>
          <div className="queue-strip mt-4">
            {thoughts.filter((item) => item.replies.length === 0).map((item) => (
              <button key={item.id} className="queue-card" onClick={() => openThought(item)}><div className="flex items-center justify-between gap-2"><span className="thread-author">{item.senderName || 'Anonymous'}</span><span className="new-label">reply</span></div><p className="mt-2 line-clamp-2 text-sm">{item.text}</p></button>
            ))}
            {!thoughts.some((item) => item.replies.length === 0) && <div className="queue-empty">Nothing waiting on you.</div>}
          </div>
        </section>
      </section>
    </main>
  )

  return (
    <main className="funky-page min-h-screen px-5 py-6 text-foreground sm:px-8">
      <div className="ambient-backdrop" aria-hidden="true"><div className="pixel-sky" /><div className="arcade-sun" /><div className="arcade-horizon" /><div className="arcade-grid" /><div className="arcade-scanline" /><div className="pixel-rain"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="pixel-snow"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="arcade-corners" /></div>

      <header className="relative z-10 mx-auto flex max-w-4xl items-center justify-between">
        <div className="brand-mark"><span className="brand-glyph" aria-hidden="true"><i /><i /><i /></span><span className="brand-name">Fowzan's <b>inbox</b></span></div>
        <button className="owner-link" onClick={() => setView('private')}><LockKeyhole size={14} /> private inbox</button>
      </header>

      <section className="relative z-10 mx-auto max-w-4xl pb-16 pt-14 sm:pt-24">
        <div className="identity-row">
          <div className="avatar funky-avatar"><MessageCircle size={24} strokeWidth={1.8} /></div>
          <div>
            <div className="eyebrow"><span className="eyebrow-pulse" /> anonymous mode</div>
            <p className="mt-2 text-sm text-muted-foreground">Send a message without showing your name.</p>
          </div>
        </div>

        <div className="hero-copy">
          <div>
            <h1 className="display-title">Say it.<br /><span>Leave it here.</span></h1>
            <p className="hero-line">Drop a message, ask a question, or leave a thought. No introduction required.</p>
          </div>
        </div>

        <div className="question-box mt-10 w-full text-left">
          <div className="question-label"><span className="signal-dot" /> leave a message</div>
          <div className="message-shell funky-shell">
            <textarea value={thought} onChange={(event) => setThought(event.target.value)} placeholder="write whatever you want..." rows={5} maxLength={500} aria-label="Your anonymous message" />
            <div className="flex items-center justify-between border-t border-border/70 pt-4">
              <span className={`text-xs ${thought.length > 450 ? 'text-punch' : 'text-muted-foreground'}`}>{thought.length}/500</span>
              <span className="text-xs text-muted-foreground">anonymous by default</span>
            </div>
          </div>

          <div className="name-controls mt-3">
            <label className="name-toggle">
              <input type="checkbox" checked={revealName} onChange={(event) => setRevealName(event.target.checked)} />
              <span className="toggle-track" /> Attach my name
            </label>
            {revealName && <input className="name-input" value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder="Name shown to Fowzan" aria-label="Your display name" maxLength={80} />}
          </div>

          <button className="funky-button mt-3 w-full" onClick={submitThought} disabled={!thought.trim() || sending}>
            {sending ? <><Loader2 size={16} className="animate-spin" /> sending...</> : <>send message <ArrowLeft className="rotate-180" size={16} /></>}
          </button>
        </div>

        <div className="prompt-deck mt-8">
          <div className="section-kicker"><Sparkles size={13} /> need a starting point?</div>
          <div className="prompt-tiles mt-3">
            {prompts.map((prompt) => (
              <button key={prompt} className="prompt-tile" onClick={() => setThought(prompt)}>{prompt}</button>
            ))}
          </div>
        </div>

        {error && <div className="error-banner mt-6" role="alert">{error}</div>}

        <div className="mt-8 flex flex-wrap justify-center gap-5">
          <button className="share-link" onClick={sharePage}>{copied ? <Check size={14} /> : <Share2 size={14} />} {copied ? 'link copied' : 'share this inbox'}</button>
        </div>
      </section>

      <section className="responses-section relative z-10 mx-auto max-w-4xl border-t border-border/70 pb-24 pt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="section-kicker"><MessageCircle size={14} /> public conversations</div>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.04em]">Open <span>threads.</span></h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Questions Fowzan has chosen to answer publicly. Join a thread without creating an account.</p>
          </div>
          <span className="soft-pill">{responses.length} threads</span>
        </div>

        {loading ? (
          <div className="empty-note mt-8"><Loader2 className="mx-auto mb-3 animate-spin" size={20} />Loading messages...</div>
        ) : (
          <div className="mt-8 space-y-4">
            {responses.map((response) => (
              <article key={response.id} className="response-card">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-punch" /><span>{response.author}</span></span>
                  <span>{formatTime(response.time)}</span>
                </div>
                <p className="mt-5 font-serif text-2xl leading-tight">{response.text}</p>
                <div className="mt-6 border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{response.replies.length} {response.replies.length === 1 ? 'reply' : 'replies'}</span>
                    <button className="reply-trigger" onClick={() => setReplyingTo(replyingTo === response.id ? null : response.id)}><MessageCircle size={14} /> reply</button>
                  </div>
                  {response.replies.length > 0 && (
                    <div className="mt-4 space-y-2 pl-0 sm:pl-4">
                      {response.replies.map((reply) => (
                        <div key={reply.id} className="reply-card">
                          <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><span className={reply.author === 'Fowzan' ? 'fowzan-author' : ''}>{reply.author}</span><span>{formatTime(reply.time)}</span></div>
                          <p className="mt-2 text-sm leading-6 text-foreground/85">{reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {replyingTo === response.id && (
                    <div className="mt-4 space-y-2">
                      <div className="reply-form">
                        <input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="add to the conversation..." aria-label="Reply" maxLength={1000} />
                        <button onClick={() => submitReply(response.id)} disabled={!replyText.trim()} aria-label="Send reply"><ArrowLeft className="rotate-180" size={16} /></button>
                      </div>
                      <label className="name-toggle pl-2"><input type="checkbox" checked={replyReveal} onChange={(event) => setReplyReveal(event.target.checked)} /><span className="toggle-track" /> show my name</label>
                      {replyReveal && <input className="name-input ml-2" value={replyName} onChange={(event) => setReplyName(event.target.value)} placeholder="display name" maxLength={80} />}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {!responses.length && <div className="empty-note">No open threads yet. Be the first to start one.</div>}
          </div>
        )}
      </section>

      {sent && (
        <div className="modal-backdrop" onClick={() => setSent(false)}>
          <article className="note-modal text-center" onClick={(event) => event.stopPropagation()}>
            <div className="success-mark"><Check size={20} /></div>
            <h2 className="mt-6 font-serif text-4xl tracking-[-0.04em]">Message received.</h2>
            <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-muted-foreground">Your message is in. Send another whenever you want.</p>
            <button className="funky-button mt-8 w-full" onClick={() => setSent(false)}>send another message</button>
          </article>
        </div>
      )}
    </main>
  )
}

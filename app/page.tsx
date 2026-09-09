'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Check, LockKeyhole, MessageCircle, Share2, Sparkles, Star, X, LogOut, Loader2, Radio, Zap, Inbox, Send, Shield
} from 'lucide-react'

type Thought = {
  id: number
  text: string
  time: string
  unread?: boolean
  kept?: boolean
  senderName?: string | null
}

type PublicResponse = {
  id: number
  text: string
  time: string
  author: string
  replies: { id: number; text: string; time: string; author: string }[]
}

const prompts = [
  'What have you always wanted to ask me?',
  'What was your first impression of me?',
  'What is something I should hear honestly?',
  'What question have you been overthinking?',
  'What is one thing I should try this year?',
  'Drop a thought with zero context.'
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
  const [ambientScene, setAmbientScene] = useState<'stars' | 'snow' | 'orbits' | 'grid'>('stars')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [publicError, setPublicError] = useState('')

  const visibleThoughts = useMemo(
    () => showKeeps ? thoughts.filter((item) => item.kept) : thoughts,
    [showKeeps, thoughts]
  )
  const unreadCount = thoughts.filter((item) => item.unread).length

  async function loadPublic() {
    try {
      const response = await fetch('/api/messages?view=public', { cache: 'no-store' })
      if (!response.ok) throw new Error('Public threads are temporarily offline.')
      const data = await response.json()
      setResponses(data.responses ?? [])
    } catch (err) {
      setPublicError(err instanceof Error ? err.message : 'Public threads are temporarily offline.')
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
    setThoughts(data.messages ?? [])
    setResponses(data.responses ?? [])
    setAnsweredThoughtIds(data.answeredThoughtIds ?? [])
  }

  useEffect(() => {
    loadPublic()
    const scenes: Array<'stars' | 'snow' | 'orbits' | 'grid'> = ['stars', 'snow', 'orbits', 'grid']
    const timer = window.setInterval(() => {
      setAmbientScene((current) => scenes[(scenes.indexOf(current) + 1) % scenes.length])
    }, 9000)
    return () => window.clearInterval(timer)
  }, [])

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

  async function submitOwnerReply(id: number, questionText?: string) {
    const text = ownerReplies[id]?.trim()
    if (!text) return
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'owner-reply', messageId: id, text, questionText })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not post the reply.')
      setOwnerReplies((current) => ({ ...current, [id]: '' }))
      await loadOwner()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the reply.')
    }
  }

  async function deleteThought(id: number) {
    try {
      const response = await fetch(`/api/messages?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not delete the message.')
      setThoughts((current) => current.filter((item) => item.id !== id))
      setSelected(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the message.')
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
        await navigator.share({ title: 'Fowzan Kar — Anonymous Drop', text: 'Leave Fowzan Kar an anonymous message.', url })
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
        <div className="secret-sticker"><Shield size={14} /> Fowzan Kar · private</div>
        <h1 className="display-title mt-6">Your<br /><span>inbox.</span></h1>
        <p className="mt-6 max-w-xs text-sm leading-6 text-muted-foreground">
          A private space for messages people leave you. Your private control room for incoming drops, threads, replies and keepsakes.
        </p>
        <form onSubmit={unlock} className="mt-9 space-y-3">
          <label className="sr-only" htmlFor="owner-password">Owner password</label>
          <input
            id="owner-password"
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="enter your password"
            className="funky-input"
            autoComplete="current-password"
          />
          {loginError && <p className="text-xs text-accent" role="alert">{loginError}</p>}
          <button className="funky-button w-full" type="submit" disabled={!password.trim()}>
            Sign in <ArrowLeft className="rotate-180" size={16} />
          </button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground/70">SECURE SESSION · PRIVATE ACCESS</p>
      </section>
    </main>
  )

  if (view === 'private') return (
    <main className="funky-page min-h-screen px-5 py-6 text-foreground sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <button className="back-button" onClick={() => setView('public')}><ArrowLeft size={16} /> public page</button>
        <div className="flex items-center gap-3">
          <button className="keep-filter" onClick={() => setShowKeeps(!showKeeps)}>
            <Star size={15} fill={showKeeps ? 'currentColor' : 'none'} /> {showKeeps ? 'all messages' : 'keepsakes'}
          </button>
          <button className="keep-filter" onClick={logout}><LogOut size={15} /> sign out</button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl pb-16 pt-14 sm:pt-20">
        <div className="flex flex-wrap items-center gap-3">
          <div className="secret-sticker"><Inbox size={14} /> Fowzan Kar · private inbox</div>
          <span className="soft-pill">{unreadCount} unread</span>
        </div>
        <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="display-title">{showKeeps ? <>Worth<br /><span>keeping.</span></> : <>What people<br /><span>left you.</span></>}</h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
              {showKeeps ? 'Messages you chose to keep close.' : 'Read, reply, save or remove messages from your private inbox.'}
            </p>
          </div>
          <button className="share-icon" onClick={sharePage} aria-label="Share Fowzan Kar drop link">
            <Share2 size={17} />
          </button>
        </div>

        {error && <div className="error-banner mt-8" role="alert">{error}</div>}

        <div className="inbox-layout mt-10">
          <section className="inbox-panel">
            <div className="inbox-panel-head">
              <div>
                <div className="section-kicker"><Inbox size={14} /> all threads</div>
                <p className="mt-1 text-xs text-muted-foreground">Incoming transmissions</p>
              </div>
              <span className="soft-pill">{visibleThoughts.length}</span>
            </div>

            <div className="inbox-feed" aria-label="Message cards">
              {visibleThoughts.map((item) => (
                <button key={item.id} onClick={() => openThought(item)} className={`funky-card group ${item.unread ? 'funky-card-new' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-punch" />
                      <span className="truncate">{item.senderName || 'Anonymous'}</span>
                    </span>
                    {item.unread && <span className="new-label shrink-0">new</span>}
                  </div>
                  <span className="mt-4 line-clamp-3 block text-left font-serif text-xl leading-tight tracking-[-0.02em]">{item.text}</span>
                  <span className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatTime(item.time)}</span>
                    <span className="opacity-0 transition group-hover:opacity-70">open →</span>
                  </span>
                </button>
              ))}
              {!visibleThoughts.length && <div className="empty-note">{showKeeps ? 'Nothing kept here yet.' : 'Your inbox is empty.'}</div>}
            </div>
          </section>

          <section className="reply-queue-panel">
            <div className="inbox-panel-head">
              <div>
                <div className="section-kicker"><MessageCircle size={14} /> reply queue</div>
                <p className="mt-1 text-xs text-muted-foreground">Threads waiting for a first reply</p>
              </div>
              <span className="queue-count">{thoughts.filter((item) => !answeredThoughtIds.includes(item.id)).length}</span>
            </div>

            <div className="reply-queue-feed">
              {thoughts.filter((item) => !answeredThoughtIds.includes(item.id)).map((item) => (
                <div key={item.id} className="owner-thread">
                  <button className="queue-message" onClick={() => openThought(item)}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="thread-author">{item.senderName || 'Anonymous'}</span>
                      <span className="queue-status">waiting</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-foreground/85">{item.text}</p>
                    <span className="mt-2 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{formatTime(item.time)}</span>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={ownerReplies[item.id] ?? ''}
                      onChange={(event) => setOwnerReplies((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="reply as Fowzan Kar..."
                      aria-label={`Reply to ${item.text}`}
                      className="name-input min-w-0 flex-1"
                      maxLength={1000}
                    />
                    <button className="funky-button queue-post" onClick={() => submitOwnerReply(item.id, item.text)} disabled={!ownerReplies[item.id]?.trim()}>post</button>
                  </div>
                </div>
              ))}
              {!thoughts.some((item) => !answeredThoughtIds.includes(item.id)) && (
                <div className="queue-empty">
                  <Check size={18} />
                  <span>QUEUE CLEAR. YOU'RE CAUGHT UP.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <article className="note-modal" onClick={(event) => event.stopPropagation()}>
            <button className="absolute right-5 top-5 text-muted-foreground" onClick={() => setSelected(null)} aria-label="Close message"><X size={18} /></button>
            <div className="secret-sticker"><span className="h-2 w-2 rounded-full bg-punch" /> {selected.senderName || 'Anonymous'}</div>
            <p className="mt-10 font-serif text-3xl leading-tight tracking-[-0.03em]">{selected.text}</p>
            <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
              <span>{formatTime(selected.time)}</span>
              <div className="flex flex-wrap gap-2">
                <button className="small-action" onClick={() => toggleKeep(selected.id)}><Star size={14} fill={selected.kept ? 'currentColor' : 'none'} /> {selected.kept ? 'Kept' : 'Keep'}</button>
                <button className="small-action" onClick={() => deleteThought(selected.id)}><X size={14} /> Delete</button>
                <button className="small-action" onClick={() => setShareCard(selected)}><Share2 size={14} /> Share</button>
              </div>
            </div>
          </article>
        </div>
      )}
      {shareCard && (
        <div className="modal-backdrop" onClick={() => setShareCard(null)}>
          <article className="share-card" onClick={(event) => event.stopPropagation()}>
            <div className="secret-sticker sticker-dark"><Radio size={13} /> Fowzan Kar · shared drop</div>
            <p className="mt-12 font-serif text-3xl leading-tight">{shareCard.text}</p>
            <div className="mt-16 text-xs uppercase tracking-[0.2em] text-primary-foreground/60">anonymous · {formatTime(shareCard.time)}</div>
            <button className="funky-button funky-button-light mt-8 w-full" onClick={() => setShareCard(null)}>Done</button>
          </article>
        </div>
      )}
    </main>
  )

  return (
    <main className={`funky-page scene-${ambientScene} min-h-screen px-5 py-6 text-foreground sm:px-8`}>
      <div className="ambient-backdrop" aria-hidden="true"><div className="ambient-grid" />{Array.from({ length: 20 }).map((_, index) => <span key={index} className="ambient-particle" style={{ '--particle': index } as React.CSSProperties} />)}</div>

      <header className="relative z-10 mx-auto flex max-w-4xl items-center justify-between">
        <div className="brand-mark"><span className="brand-icon"><Radio size={17} /></span><span>Fowzan Kar</span></div>
        <button className="owner-link" onClick={() => setView('private')}><LockKeyhole size={14} /> private inbox</button>
      </header>

      <section className="relative z-10 mx-auto max-w-4xl pb-16 pt-14 sm:pt-24">
        <div className="identity-row">
          <div className="identity-icon"><Radio size={22} /></div>
          <div>
            <div className="eyebrow"><Radio size={13} /> anonymous drop zone</div>
            <p className="mt-2 text-sm text-muted-foreground">ASK. CONFESS. DROP A THOUGHT.</p>
          </div>
        </div>

        <div className="hero-copy">
          <div>
            <h1 className="display-title">DROP A THOUGHT.<br /><span>START A THREAD.</span></h1>
            <p className="hero-line">A low-key space for questions, hot takes, random thoughts, and the things you would rather type than say out loud.</p>
          </div>
          <div className="orbit-note"><Zap size={12} /> instant drop<br />anonymous mode on<br />no profile required</div>
        </div>

        <div className="question-box mt-10 w-full text-left">
          <div className="question-label"><span className="signal-dot" /> leave a message</div>
          <div className="message-shell funky-shell">
            <textarea value={thought} onChange={(event) => setThought(event.target.value)} placeholder="type the thing you came here to say..." rows={5} maxLength={500} aria-label="Your anonymous message" />
            <div className="flex items-center justify-between border-t border-border/70 pt-4">
              <span className={`text-xs ${thought.length > 450 ? 'text-punch' : 'text-muted-foreground'}`}>{thought.length}/500</span>
              <span className="text-xs text-muted-foreground">anonymous mode on</span>
            </div>
          </div>

          <div className="name-controls mt-3">
            <label className="name-toggle">
              <input type="checkbox" checked={revealName} onChange={(event) => setRevealName(event.target.checked)} />
              <span className="toggle-track" /> reveal my name
            </label>
            {revealName && <input className="name-input" value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder="display name" aria-label="Your display name" maxLength={80} />}
          </div>

          <button className="funky-button mt-3 w-full" onClick={submitThought} disabled={!thought.trim() || sending}>
            {sending ? <><Loader2 size={16} className="animate-spin" /> sending drop...</> : <><Send size={15} /> send the drop</>}
          </button>
        </div>

        <div className="prompt-deck mt-8">
          <div className="section-kicker"><Sparkles size={13} /> NEED A STARTER?</div>
          <div className="prompt-tiles mt-3">
            {prompts.map((prompt) => (
              <button key={prompt} className="prompt-tile" onClick={() => setThought(prompt)}>{prompt}</button>
            ))}
          </div>
        </div>

        {publicError && <div className="error-banner mt-6" role="alert">{publicError}</div>}

        <div className="mt-8 flex flex-wrap justify-center gap-5">
          <button className="share-link" onClick={sharePage}>{copied ? <Check size={14} /> : <Share2 size={14} />} {copied ? 'link copied' : 'share the drop link'}</button>
          <span className="text-xs text-muted-foreground/70">no login required</span>
        </div>
      </section>

      <section className="responses-section relative z-10 mx-auto max-w-4xl border-t border-border/70 pb-24 pt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="section-kicker"><MessageCircle size={14} /> public signal</div>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.04em]">LIVE <span>THREADS.</span></h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Conversations opened by Fowzan. Jump in without creating an account.</p>
          </div>
          <span className="soft-pill">{responses.length} threads</span>
        </div>

        {loading ? (
          <div className="empty-note mt-8"><Loader2 className="mx-auto mb-3 animate-spin" size={20} />Loading conversations...</div>
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
            {!responses.length && <div className="empty-note">No live threads yet. Start one by asking a question.</div>}
          </div>
        )}
      </section>

      {sent && (
        <div className="modal-backdrop" onClick={() => setSent(false)}>
          <article className="note-modal text-center" onClick={(event) => event.stopPropagation()}>
            <div className="success-mark"><Check size={20} /></div>
            <h2 className="mt-6 font-serif text-4xl tracking-[-0.04em]">DROP RECEIVED.</h2>
            <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-muted-foreground">Your message just landed in Fowzan’s inbox. Send another whenever you feel like it.</p>
            <button className="funky-button mt-8 w-full" onClick={() => setSent(false)}>send another drop</button>
          </article>
        </div>
      )}
    </main>
  )
}

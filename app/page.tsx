'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Check, ChevronRight, Inbox, LockKeyhole, LogOut,
  Mail, MessageCircle, PenLine, RefreshCw, Send, Share2, Sparkles,
  Star, Trash2, X, Loader2, ShieldCheck, Zap, CircleDot
} from 'lucide-react'

type ThreadReply = { id: number; text: string; time: string; author: string }
type Thought = { id: number; text: string; time: string; unread?: boolean; kept?: boolean; senderName?: string | null; replies: ThreadReply[] }
type PublicResponse = { id: number; text: string; time: string; author: string; replies: ThreadReply[] }

const prompts = [
  'What are you really into these days?',
  'What is a hobby you could talk about for hours?',
  'What is something you want to learn?',
  'What is a random fact about you?',
  'What is a goal you are working towards?',
  'What is your most unpopular opinion?',
  'What is something that always makes you laugh?',
  'If you could try anything for a day, what would it be?'
]

// Every Matrix stream is a phonetic rendering of “Fowzan” in a different script.
// No random words: the rain visually spells the same name across languages.
const matrixStreams = [
  'ファウザン', '法乌赞', '파우잔', 'فوزان',
  'Φαουζάν', 'Фаузан', 'פאוזאן', 'ฟาวซาน',
  'Ֆաուզան', 'ფაუზან', 'فَوْزَان', 'ファウザーン',
  'FAWZAN', 'FOWZAN', 'Fawzan', 'fawzan'
]

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = date.getTime() - Date.now()
  const minutes = Math.round(diff / 60000)
  if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(hours, 'hour')
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(hours / 24), 'day')
}

export default function Page() {
  const [view, setView] = useState<'public' | 'private'>('public')
  const [theme, setTheme] = useState<'green' | 'red' | 'blue' | 'purple'>('purple')
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
  const [responses, setResponses] = useState<PublicResponse[]>([])
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyName, setReplyName] = useState('')
  const [replyReveal, setReplyReveal] = useState(false)
  const [ownerReplies, setOwnerReplies] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [replySending, setReplySending] = useState<number | null>(null)
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const visibleThoughts = useMemo(() => showKeeps ? thoughts.filter((item) => item.kept) : thoughts, [showKeeps, thoughts])
  const unreadCount = thoughts.filter((item) => item.unread).length
  const waitingCount = thoughts.filter((item) => item.replies.length === 0).length
  const replyCount = thoughts.reduce((sum, item) => sum + item.replies.length, 0)

  async function loadPublic() {
    try {
      const response = await fetch('/api/messages?view=public', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load public conversations.')
      const data = await response.json()
      setResponses(data.responses ?? [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load the page.') }
    finally { setLoading(false) }
  }

  async function loadOwner(silent = false) {
    if (!silent) setRefreshing(true)
    try {
      const response = await fetch('/api/messages?view=owner', { cache: 'no-store' })
      if (response.status === 401) { setOwnerUnlocked(false); return }
      if (!response.ok) throw new Error('Could not load your inbox.')
      const data = await response.json()
      const nextMessages: Thought[] = data.messages ?? []
      setThoughts(nextMessages)
      setResponses(data.responses ?? [])
      setSelected((current) => current ? nextMessages.find((item) => item.id === current.id) ?? null : null)
      setLastUpdated(new Date())
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not refresh your inbox.') }
    finally { if (!silent) setRefreshing(false) }
  }

  useEffect(() => {
    loadPublic()
    const timer = window.setInterval(() => { if (view === 'public') loadPublic() }, 30000)
    return () => window.clearInterval(timer)
  }, [view])

  useEffect(() => {
    if (view !== 'private' || !ownerUnlocked) return
    const timer = window.setInterval(() => { loadOwner(true) }, 10000)
    return () => window.clearInterval(timer)
  }, [view, ownerUnlocked])

  async function submitThought() {
    const text = thought.trim(); if (!text || sending) return
    setSending(true); setError('')
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'message', text, senderName: revealName ? senderName.trim() : null }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not send your message.')
      setThought(''); setSenderName(''); setRevealName(false); setSent(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send your message.') }
    finally { setSending(false) }
  }

  async function submitReply(id: number) {
    const text = replyText.trim(); if (!text) return
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'public-reply', messageId: id, text, senderName: replyReveal ? replyName.trim() : null }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Could not post your reply.')
      setReplyText(''); setReplyName(''); setReplyReveal(false); setReplyingTo(null); await loadPublic()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not post your reply.') }
  }

  async function submitOwnerReply(id: number) {
    const text = ownerReplies[id]?.trim(); if (!text || replySending === id) return
    setReplySending(id); setError('')
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'owner-reply', messageId: id, text }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Could not post the reply.')
      setOwnerReplies((current) => ({ ...current, [id]: '' })); await loadOwner(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not post the reply.') }
    finally { setReplySending(null) }
  }

  async function deleteThought(id: number) {
    if (deleteBusy) return
    if (!window.confirm('Delete this entire thread? This will permanently remove the original message and every reply.')) return
    setDeleteBusy(`thread-${id}`); setError('')
    try {
      const response = await fetch(`/api/messages?id=${id}&type=thread`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Could not delete the thread.')
      setThoughts((current) => current.filter((item) => item.id !== id)); setSelected(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete the thread.') }
    finally { setDeleteBusy(null) }
  }

  async function deleteReply(messageId: number, replyId: number) {
    if (deleteBusy) return
    setDeleteBusy(`reply-${replyId}`); setError('')
    try {
      const response = await fetch(`/api/messages?id=${replyId}&messageId=${messageId}&type=reply`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Could not delete the reply.')
      setThoughts((current) => current.map((item) => item.id === messageId ? { ...item, replies: item.replies.filter((reply) => reply.id !== replyId) } : item))
      setSelected((current) => current?.id === messageId ? { ...current, replies: current.replies.filter((reply) => reply.id !== replyId) } : current)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete the reply.') }
    finally { setDeleteBusy(null) }
  }

  async function toggleKeep(id: number) {
    try {
      const response = await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'toggle-keep' }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Could not update the message.')
      setThoughts((current) => current.map((entry) => entry.id === id ? { ...entry, kept: data.kept } : entry))
      setSelected((current) => current?.id === id ? { ...current, kept: data.kept } : current)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update the message.') }
  }

  async function sharePage() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: "Fowzan's anonymous inbox", text: 'Leave Fowzan an anonymous message.', url })
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    } catch { setCopied(false) }
  }

  async function unlock(event: React.FormEvent) {
    event.preventDefault(); setLoginError('')
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const type = response.headers.get('content-type') ?? ''; const data = type.includes('application/json') ? await response.json() : { error: await response.text() }
      if (!response.ok) throw new Error(data.error ?? 'Invalid password.')
      setOwnerUnlocked(true); setPassword(''); void loadOwner()
    } catch (err) { setLoginError(err instanceof Error ? err.message : 'Unable to sign in.') }
  }

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); setOwnerUnlocked(false); setView('public'); setThoughts([]); setSelected(null) }

  function openThought(item: Thought) {
    setSelected(item)
    if (item.unread) {
      setThoughts((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))
      fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, action: 'read' }) }).catch(() => {})
    }
  }

  if (view === 'private' && !ownerUnlocked) return (
    <main className="app-page private-login-page" data-theme={theme}>
      <div className="ambient-orb orb-a" /><div className="ambient-orb orb-b" />
      <div className="login-shell">
        <button className="ghost-button" onClick={() => setView('public')}><ArrowLeft size={15} /> back</button>
        <div className="login-card">
          <div className="private-badge"><ShieldCheck size={14} /> owner access</div>
          <h1 className="login-title">Your<br /><span>private room.</span></h1>
          <p>Everything people leave here, in one quiet place. Sign in to read, reply and manage your threads.</p>
          <form onSubmit={unlock} className="login-form">
            <input autoFocus id="owner-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="owner password" autoComplete="current-password" />
            {loginError && <div className="inline-error">{loginError}</div>}
            <button className="primary-button" type="submit" disabled={!password.trim()}>Open inbox <ChevronRight size={17} /></button>
          </form>
        </div>
      </div>
    </main>
  )

  if (view === 'private') return (
    <main className="app-page admin-page" data-theme={theme}>
      <div className="ambient-orb orb-a" /><div className="ambient-orb orb-c" />
      <header className="topbar admin-topbar">
        <button className="brand wordmark" onClick={() => setView('public')}>FOWZAN&apos;S INBOX</button>
        <div className="top-actions"><button className="ghost-button" onClick={() => setShowKeeps(!showKeeps)}><Star size={14} fill={showKeeps ? 'currentColor' : 'none'} /> {showKeeps ? 'all threads' : 'keepsakes'}</button><button className="ghost-button" onClick={logout}><LogOut size={14} /> sign out</button></div>
      </header>

      <section className="admin-hero page-width">
        <div><div className="eyebrow"><Inbox size={14} /> private inbox</div><h1 className="admin-title">Your<br /><span>conversations.</span></h1><p className="admin-subtitle">A calm workspace for everything people leave you. Reply freely, keep what matters, and clean up any message.</p></div>
        <div className="admin-hero-actions"><button className="refresh-button" onClick={() => loadOwner()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> {refreshing ? 'refreshing' : 'refresh inbox'}</button><button className="share-square" onClick={sharePage} aria-label="Share inbox">{copied ? <Check size={17} /> : <Share2 size={17} />}</button></div>
      </section>

      {error && <div className="error-banner page-width">{error}</div>}

      <section className="quick-stats page-width">
        <div className="stat-card"><span>threads</span><strong>{thoughts.length}</strong><small>all conversations</small></div>
        <div className="stat-card accent-stat"><span>waiting</span><strong>{waitingCount}</strong><small>need your first reply</small></div>
        <div className="stat-card"><span>replies</span><strong>{replyCount}</strong><small>across your threads</small></div>
        <div className="stat-card"><span>status</span><strong className="status-live"><CircleDot size={13} /> live</strong><small>{lastUpdated ? `updated ${formatTime(lastUpdated.toISOString())}` : 'syncing now'}</small></div>
      </section>

      <section className="admin-workspace page-width">
        <aside className="thread-browser">
          <div className="browser-head"><div><div className="eyebrow"><MessageCircle size={13} /> all threads</div><p>{visibleThoughts.length} {visibleThoughts.length === 1 ? 'conversation' : 'conversations'}</p></div><span className="live-dot"><i /> live</span></div>
          <div className="thread-list">
            {visibleThoughts.map((item) => <button key={item.id} onClick={() => openThought(item)} className={`thread-item ${selected?.id === item.id ? 'active' : ''}`}>
              <div className="thread-item-top"><span>{item.senderName || 'Anonymous'}</span>{item.unread && <b>new</b>}</div>
              <p>{item.text}</p><div><span>{item.replies.length} {item.replies.length === 1 ? 'reply' : 'replies'}</span><span>{formatTime(item.time)}</span></div>
            </button>)}
            {!visibleThoughts.length && <div className="empty-browser"><MessageCircle size={20} /><strong>{showKeeps ? 'No keepsakes yet' : 'Your inbox is empty'}</strong><span>New anonymous messages will appear here.</span></div>}
          </div>
        </aside>

        <section className="conversation-shell">
          {!selected ? <div className="conversation-empty"><div className="empty-icon"><MessageCircle size={23} /></div><h2>Choose a conversation</h2><p>Select a message from the left to open its thread.</p></div> : <div className="conversation-card">
            <div className="conversation-head"><div><div className="eyebrow"><Zap size={13} /> thread</div><h2>{selected.senderName || 'Anonymous'}</h2><p>{selected.replies.length} {selected.replies.length === 1 ? 'reply' : 'replies'} · {formatTime(selected.time)}</p></div><div className="conversation-actions"><button className="icon-action" onClick={() => toggleKeep(selected.id)} title={selected.kept ? 'Remove from keepsakes' : 'Keep thread'}><Star size={15} fill={selected.kept ? 'currentColor' : 'none'} /></button><button className="delete-thread-button" onClick={() => deleteThought(selected.id)} disabled={deleteBusy === `thread-${selected.id}`}><Trash2 size={14} /> {deleteBusy === `thread-${selected.id}` ? 'deleting' : 'delete thread'}</button></div></div>
            <div className="conversation-scroll">
              <article className="chat-bubble incoming"><div className="bubble-meta"><span>{selected.senderName || 'Anonymous'}</span><span>{formatTime(selected.time)}</span></div><p>{selected.text}</p></article>
              {selected.replies.map((reply) => <article key={reply.id} className={`chat-bubble ${reply.author === 'Fowzan' ? 'outgoing' : 'incoming'}`}><div className="bubble-meta"><span>{reply.author === 'Fowzan' ? 'Fowzan' : reply.author}</span><span>{formatTime(reply.time)}</span></div><p>{reply.text}</p><button className="bubble-delete" onClick={() => deleteReply(selected.id, reply.id)} disabled={deleteBusy === `reply-${reply.id}`} title="Remove only this reply" aria-label="Remove only this reply"><Trash2 size={11} /> {deleteBusy === `reply-${reply.id}` ? 'deleting' : 'remove reply'}</button></article>)}
            </div>
            <div className="reply-dock"><div className="reply-composer"><input value={ownerReplies[selected.id] ?? ''} onChange={(e) => setOwnerReplies((c) => ({ ...c, [selected.id]: e.target.value }))} placeholder="Write a reply as Fowzan…" maxLength={1000} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitOwnerReply(selected.id) } }} /><button onClick={() => submitOwnerReply(selected.id)} disabled={!ownerReplies[selected.id]?.trim() || replySending === selected.id}>{replySending === selected.id ? <Loader2 size={17} className="spin" /> : <Send size={16} />}</button></div><div className="composer-foot"><span>Reply as many times as you want.</span><span>{(ownerReplies[selected.id] ?? '').length}/1000</span></div></div>
          </div>}
        </section>
      </section>

      <section className="queue-section page-width"><div className="queue-head"><div><div className="eyebrow"><PenLine size={13} /> quick reply queue</div><h2>Threads waiting on you.</h2></div><span>{waitingCount} waiting</span></div><div className="queue-grid">{thoughts.filter((item) => item.replies.length === 0).map((item) => <button key={item.id} className="queue-item" onClick={() => openThought(item)}><span>{item.senderName || 'Anonymous'}</span><p>{item.text}</p><b>reply <ChevronRight size={13} /></b></button>)}{waitingCount === 0 && <div className="queue-clear"><Check size={17} /> You're all caught up.</div>}</div></section>
    </main>
  )

  return (
    <main className="app-page public-page" data-theme={theme}>
      <div className="cyber-bg" aria-hidden="true"><i /><i /><i />{matrixStreams.map((stream, index) => <b key={index}>{Array.from(stream).map((char, charIndex) => <span key={charIndex}>{char}</span>)}</b>)}</div><div className="ambient-orb orb-a" /><div className="ambient-orb orb-b" /><div className="ambient-orb orb-d" /><div className="grain" />
      <div className="particle-field" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
      <header className="topbar public-topbar"><button className="brand wordmark" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Mail size={16} /> FOWZAN&apos;S INBOX</button><div className="topbar-controls"><label className="theme-picker"><span>THEME</span><select aria-label="Choose color theme" value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}><option value="green">GREEN</option><option value="red">RED</option><option value="blue">BLUE</option><option value="purple">PURPLE</option></select></label><button className="private-button" onClick={() => setView('private')}><LockKeyhole size={14} /> private inbox</button></div></header>

      <section className="public-hero page-width">
        <div className="hero-badge"><span /> ANONYMOUS MESSAGES TO FOWZAN</div>
        <h1>SEND FOWZAN<br /><em>A MESSAGE.</em></h1>
        <p className="hero-lead">Say whatever you want to say. Ask a question, leave a thought, or just check in. Your name stays hidden unless you choose to add it.</p>
        <div className="hero-actions"><a href="#leave-message" className="primary-button">send a message <ChevronRight size={17} /></a><button className="secondary-button" onClick={sharePage}>{copied ? <Check size={15} /> : <Share2 size={15} />} {copied ? 'link copied' : "share Fowzan's inbox"}</button></div>
      </section>

      <section id="leave-message" className="composer-section page-width"><div className="section-intro"><div className="eyebrow"><PenLine size={13} /> MESSAGE FOWZAN</div><h2>WHAT DO YOU<br /><span>WANT TO SAY?</span></h2></div>
        <div className="message-composer"><div className="composer-label"><span className="pulse-dot" /> YOUR ANONYMOUS MESSAGE</div><textarea value={thought} onChange={(e) => setThought(e.target.value)} placeholder="Write whatever you want to say to Fowzan..." rows={5} maxLength={500} /><div className="composer-meta"><span>{thought.length}/500</span><span>your name is hidden</span></div></div>
        <div className="identity-controls"><label><input type="checkbox" checked={revealName} onChange={(e) => setRevealName(e.target.checked)} /><span className="switch" /> include my name</label>{revealName && <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="display name" maxLength={80} />}</div>
        <button className="primary-button send-button" onClick={submitThought} disabled={!thought.trim() || sending}>{sending ? <><Loader2 size={16} className="spin" /> sending…</> : <>Send to Fowzan <Send size={16} /></>}</button>
      </section>

      <section className="prompt-section page-width"><div className="section-intro compact"><div className="eyebrow"><Sparkles size={13} /> NOT SURE WHAT TO ASK?</div><h2>START HERE.</h2></div><div className="prompt-grid">{prompts.map((prompt, index) => <button key={prompt} onClick={() => { setThought(prompt); document.getElementById('leave-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><span>0{index + 1}</span>{prompt}<ChevronRight size={14} /></button>)}</div></section>

      {error && <div className="error-banner page-width">{error}</div>}

      <section className="public-threads page-width"><div className="threads-heading"><div><div className="eyebrow"><MessageCircle size={13} /> FOWZAN&apos;S REPLIES</div><h2>REPLY BOARD.</h2><p>Whatever Fowzan chooses to reply to will appear here.</p></div><span>{responses.length} live</span></div>
        {loading ? <div className="loading-card"><Loader2 size={19} className="spin" /> loading Fowzan&apos;s replies…</div> : <div className="public-thread-list">{responses.map((response) => <article key={response.id} className="public-thread"><div className="thread-meta"><span><i /> {response.author}</span><span>{formatTime(response.time)}</span></div><h3>{response.text}</h3>{response.replies.length > 0 && <div className="public-replies">{response.replies.map((reply) => <div key={reply.id}><div><b className={reply.author === 'Fowzan' ? 'fowzan' : ''}>{reply.author}</b><span>{formatTime(reply.time)}</span></div><p>{reply.text}</p></div>)}</div>}<div className="public-thread-foot"><span>{response.replies.length} {response.replies.length === 1 ? 'reply' : 'replies'}</span><button onClick={() => setReplyingTo(replyingTo === response.id ? null : response.id)}><MessageCircle size={14} /> join thread</button></div>{replyingTo === response.id && <div className="public-reply-form"><div className="reply-composer"><input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Add to the conversation…" maxLength={1000} /><button onClick={() => submitReply(response.id)} disabled={!replyText.trim()}><Send size={15} /></button></div><label><input type="checkbox" checked={replyReveal} onChange={(e) => setReplyReveal(e.target.checked)} /> show my name</label>{replyReveal && <input value={replyName} onChange={(e) => setReplyName(e.target.value)} placeholder="display name" maxLength={80} />}</div>}</article>)}{!responses.length && <div className="empty-browser public-empty"><MessageCircle size={20} /><strong>Fowzan has not replied yet.</strong><span>Come back soon to see messages Fowzan chooses to answer.</span></div>}</div>}
      </section>

      {sent && <div className="modal-backdrop" onClick={() => setSent(false)}><article className="success-modal" onClick={(e) => e.stopPropagation()}><div className="success-icon"><Check size={21} /></div><div className="eyebrow">message delivered</div><h2>That was sent.</h2><p>Your message is safely in Fowzan's inbox. Leave another whenever you feel like it.</p><button className="primary-button" onClick={() => setSent(false)}>Send another <ChevronRight size={17} /></button></article></div>}
    </main>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Check, ChevronRight, Inbox, LockKeyhole, LogOut,
  Bell, BellRing, Download, Film, ImageIcon, Mail, MessageCircle, PenLine, RefreshCw, Send, Share2, Sparkles,
  Star, ThumbsUp, Trash2, X, Loader2, ShieldCheck, Zap, CircleDot, BarChart3, Plus
} from 'lucide-react'

type ThreadReply = { id: number; text: string; time: string; author: string; mediaUrl?: string | null; mediaType?: 'image' | 'gif' | null }
type Thought = { id: number; text: string; time: string; unread?: boolean; kept?: boolean; senderName?: string | null; upvotes?: number; replies: ThreadReply[] }
type PublicResponse = { id: number; text: string; time: string; author: string; upvotes?: number; replies: ThreadReply[] }
type Poll = { id: number; question: string; options: string[]; counts: number[]; totalVotes: number; time: string; imageData?: string | null }

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
  const [theme, setTheme] = useState<'white' | 'green' | 'purple' | 'red' | 'blue' | 'rose'>('purple')
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
  const [polls, setPolls] = useState<Poll[]>([])
  const [votedPolls, setVotedPolls] = useState<Record<number, number>>({})
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [pollCreating, setPollCreating] = useState(false)
  const [pollImageData, setPollImageData] = useState<string | null>(null)
  const [pollImageName, setPollImageName] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyName, setReplyName] = useState('')
  const [replyReveal, setReplyReveal] = useState(false)
  const [ownerReplies, setOwnerReplies] = useState<Record<number, string>>({})
  const [ownerMediaUrls, setOwnerMediaUrls] = useState<Record<number, string>>({})
  const [ownerMediaModes, setOwnerMediaModes] = useState<Record<number, 'image' | 'gif' | null>>({})
  const [votedThreadIds, setVotedThreadIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [replySending, setReplySending] = useState<number | null>(null)
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [threadQuery, setThreadQuery] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const replyInputRef = useRef<HTMLInputElement>(null)
  const knownThreadIds = useRef(new Set<number>())
  const inboxInitialized = useRef(false)
  const voterKey = useRef<string | null>(null)

  const visibleThoughts = useMemo(() => thoughts.filter((item) => {
    if (showKeeps && !item.kept) return false
    const query = threadQuery.trim().toLowerCase()
    return !query || item.text.toLowerCase().includes(query) || item.senderName?.toLowerCase().includes(query)
  }), [showKeeps, thoughts, threadQuery])
  const unreadCount = thoughts.filter((item) => item.unread).length
  const waitingCount = thoughts.filter((item) => item.replies.length === 0).length
  const replyCount = thoughts.reduce((sum, item) => sum + item.replies.length, 0)

  async function loadPublic() {
    try {
      const response = await fetch('/api/messages?view=public', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load public conversations.')
      const data = await response.json()
      setResponses(data.responses ?? [])
      setPolls(data.polls ?? [])
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
      const incoming = nextMessages.filter((item) => !knownThreadIds.current.has(item.id))
      if (inboxInitialized.current && incoming.length && notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification("Fowzan's Inbox", { body: `${incoming.length} new ${incoming.length === 1 ? 'message' : 'messages'} waiting for you.` })
      }
      knownThreadIds.current = new Set(nextMessages.map((item) => item.id))
      inboxInitialized.current = true
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
    try {
      const saved = JSON.parse(localStorage.getItem('fowzan-upvoted-threads') ?? '[]')
      if (Array.isArray(saved)) setVotedThreadIds(new Set(saved.filter((id) => Number.isSafeInteger(id))))
    } catch { /* A missing or malformed local preference should never affect the inbox. */ }
  }, [])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fowzan-poll-votes') ?? '{}')
      if (saved && typeof saved === 'object') setVotedPolls(saved)
      if (!localStorage.getItem('fowzan-anonymous-voter')) localStorage.setItem('fowzan-anonymous-voter', crypto.randomUUID())
      voterKey.current = localStorage.getItem('fowzan-anonymous-voter')
    } catch { voterKey.current = null }
  }, [])

  useEffect(() => {
    if (view !== 'private' || !ownerUnlocked) return
    const timer = window.setInterval(() => { loadOwner(true) }, 10000)
    return () => window.clearInterval(timer)
  }, [view, ownerUnlocked])

  useEffect(() => {
    if (view !== 'private' || !ownerUnlocked) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea, select')) return
      if (event.key === 'Escape') setSelected(null)
      if (event.key.toLowerCase() === 'r' && selected) { event.preventDefault(); replyInputRef.current?.focus() }
      if (event.key.toLowerCase() === 's' && selected) { event.preventDefault(); void toggleKeep(selected.id) }
      if ((event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'k') && visibleThoughts.length) {
        event.preventDefault()
        const currentIndex = selected ? visibleThoughts.findIndex((item) => item.id === selected.id) : -1
        const direction = event.key.toLowerCase() === 'j' ? 1 : -1
        const nextIndex = Math.max(0, Math.min(visibleThoughts.length - 1, currentIndex + direction))
        openThought(visibleThoughts[nextIndex])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view, ownerUnlocked, selected, visibleThoughts])

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
    const text = ownerReplies[id]?.trim() ?? ''
    const mediaUrl = ownerMediaUrls[id]?.trim() ?? ''
    const mediaType = ownerMediaModes[id] ?? 'image'
    if ((!text && !mediaUrl) || replySending === id) return
    setReplySending(id); setError('')
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'owner-reply', messageId: id, text, mediaUrl, mediaType }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Could not post the reply.')
      localStorage.removeItem(`fowzan-draft-${id}`)
      setOwnerReplies((current) => ({ ...current, [id]: '' })); await loadOwner(true)
      setOwnerMediaUrls((current) => ({ ...current, [id]: '' }))
      setOwnerMediaModes((current) => ({ ...current, [id]: null }))
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

  async function createPoll() {
    const question = pollQuestion.trim()
    const options = pollOptions.map((item) => item.trim()).filter(Boolean)
    if (!question || options.length < 2 || pollCreating) return
    setPollCreating(true); setError('')
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create-poll', question, options, imageData: pollImageData }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not create the poll.')
      setPollQuestion(''); setPollOptions(['', '']); setPollImageData(null); setPollImageName(''); await loadOwner(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the poll.') }
    finally { setPollCreating(false) }
  }

  async function votePoll(poll: Poll, optionIndex: number) {
    if (votedPolls[poll.id] !== undefined) return
    const key = voterKey.current || localStorage.getItem('fowzan-anonymous-voter') || crypto.randomUUID()
    voterKey.current = key; localStorage.setItem('fowzan-anonymous-voter', key)
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vote-poll', pollId: poll.id, optionIndex, voterKey: key }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Could not vote.')
      setPolls((current) => current.map((item) => item.id === poll.id ? { ...item, counts: data.counts, totalVotes: data.totalVotes } : item))
      setVotedPolls((current) => { const next = { ...current, [poll.id]: optionIndex }; localStorage.setItem('fowzan-poll-votes', JSON.stringify(next)); return next })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not vote.') }
  }

  async function deletePoll(poll: Poll) {
    if (deleteBusy) return
    if (!window.confirm('Delete this poll permanently? All anonymous votes will be removed.')) return
    setDeleteBusy(`poll-${poll.id}`)
    setError('')
    try {
      const response = await fetch(`/api/messages?id=${poll.id}&type=poll`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not delete the poll.')
      setPolls((current) => current.filter((item) => item.id !== poll.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the poll.')
    } finally {
      setDeleteBusy(null)
    }
  }

  async function sharePoll(poll: Poll) {
    const url = `${window.location.origin}/poll/${poll.id}`
    try {
      if (navigator.share) await navigator.share({ title: "A poll from Fowzan's Inbox", text: poll.question, url })
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    } catch { setCopied(false) }
  }

  async function sharePage() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: "Fowzan's anonymous inbox", text: 'Leave Fowzan an anonymous message.', url })
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    } catch { setCopied(false) }
  }

  async function shareThread(item: Thought | PublicResponse) {
    const url = `${window.location.origin}/thread/${item.id}`
    try {
      if (navigator.share) await navigator.share({ title: "A thread from Fowzan's Inbox", text: item.text.slice(0, 120), url })
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    } catch { setCopied(false) }
  }

  function downloadInbox() {
    const exportData = thoughts.map(({ id, text, senderName, time, kept, replies }) => ({ id, message: text, senderName: senderName || 'Anonymous', receivedAt: time, saved: Boolean(kept), replies }))
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `fowzans-inbox-${new Date().toISOString().slice(0, 10)}.json`; link.click()
    URL.revokeObjectURL(url)
  }

  async function toggleNotifications() {
    if (!('Notification' in window)) { setError('This browser does not support notifications.'); return }
    if (Notification.permission === 'denied') { setError('Notifications are blocked in your browser settings.'); return }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    setNotificationsEnabled(permission === 'granted')
    if (permission !== 'granted') setError('Notification permission was not granted.')
  }

  function getVoterKey() {
    if (voterKey.current) return voterKey.current
    const saved = localStorage.getItem('fowzan-voter-key')
    voterKey.current = saved || crypto.randomUUID()
    if (!saved) localStorage.setItem('fowzan-voter-key', voterKey.current)
    return voterKey.current
  }

  async function toggleUpvote(id: number) {
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle-upvote', messageId: id, voterKey: getVoterKey() }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not update the upvote.')
      setResponses((current) => current.map((thread) => thread.id === id ? { ...thread, upvotes: data.upvotes } : thread))
      setThoughts((current) => current.map((thread) => thread.id === id ? { ...thread, upvotes: data.upvotes } : thread))
      setVotedThreadIds((current) => {
        const next = new Set(current)
        if (data.voted) next.add(id); else next.delete(id)
        localStorage.setItem('fowzan-upvoted-threads', JSON.stringify([...next]))
        return next
      })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update the upvote.') }
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
    setOwnerReplies((current) => current[item.id] !== undefined ? current : { ...current, [item.id]: localStorage.getItem(`fowzan-draft-${item.id}`) ?? '' })
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
        <div className="admin-hero-actions"><button className="refresh-button" onClick={() => loadOwner()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> {refreshing ? 'refreshing' : 'refresh inbox'}</button><button className="share-square" onClick={toggleNotifications} aria-label="Toggle inbox notifications" title={notificationsEnabled ? 'Inbox notifications are on' : 'Turn on inbox notifications'}>{notificationsEnabled ? <BellRing size={17} /> : <Bell size={17} />}</button><button className="share-square" onClick={downloadInbox} aria-label="Download inbox" title="Download inbox"><Download size={17} /></button><button className="share-square" onClick={sharePage} aria-label="Share inbox">{copied ? <Check size={17} /> : <Share2 size={17} />}</button></div>
      </section>

      {error && <div className="error-banner page-width">{error}</div>}

      <section className="quick-stats page-width">
        <div className="stat-card"><span>threads</span><strong>{thoughts.length}</strong><small>all conversations</small></div>
        <div className="stat-card accent-stat"><span>waiting</span><strong>{waitingCount}</strong><small>need your first reply</small></div>
        <div className="stat-card"><span>replies</span><strong>{replyCount}</strong><small>across your threads</small></div>
        <div className="stat-card"><span>status</span><strong className="status-live"><CircleDot size={13} /> live</strong><small>{lastUpdated ? `updated ${formatTime(lastUpdated.toISOString())}` : 'syncing now'}</small></div>
      </section>

      <section className="poll-admin-card page-width">
        <div className="poll-admin-head"><div><div className="eyebrow"><BarChart3 size={13} /> wall poll</div><h2>Ask everyone.</h2><p>Create an anonymous poll that appears on the public wall.</p></div></div>
        <input className="poll-question-input" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="What do you want to ask?" maxLength={240} />
        <label className="poll-image-upload">
          <span className="poll-image-upload-copy"><ImageIcon size={15} /><b>{pollImageName ? 'image ready' : 'add an image'}</b><small>{pollImageName || 'optional · shown between the question and options'}</small></span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (file.size > 2.5 * 1024 * 1024) { setError('Poll images must be 2.5 MB or smaller.'); e.currentTarget.value = ''; return }
            const reader = new FileReader()
            reader.onload = () => { if (typeof reader.result === 'string') { setPollImageData(reader.result); setPollImageName(file.name); setError('') } }
            reader.readAsDataURL(file)
          }} />
          {pollImageData && <img src={pollImageData} alt="Poll preview" />}
          {pollImageData && <button type="button" className="poll-image-remove" onClick={(e) => { e.preventDefault(); setPollImageData(null); setPollImageName('') }}><X size={13} /> remove</button>}
        </label>
        <div className="poll-option-editor">{pollOptions.map((option, index) => <div className="poll-option-row" key={index}><span>{index + 1}</span><input value={option} onChange={(e) => setPollOptions((current) => current.map((item, i) => i === index ? e.target.value : item))} placeholder={`Option ${index + 1}`} maxLength={120} />{pollOptions.length > 2 && <button type="button" onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))}><X size={14} /></button>}</div>)}</div>
        <div className="poll-admin-actions"><button className="ghost-button" type="button" onClick={() => setPollOptions((current) => current.length < 8 ? [...current, ''] : current)} disabled={pollOptions.length >= 8}><Plus size={14} /> add option</button><button className="primary-button" type="button" onClick={createPoll} disabled={!pollQuestion.trim() || pollOptions.filter(Boolean).length < 2 || pollCreating}>{pollCreating ? 'publishing…' : <>Publish poll <ChevronRight size={16} /></>}</button></div>
      </section>

      <section className="admin-polls page-width"><div className="queue-head"><div><div className="eyebrow"><BarChart3 size={13} /> live polls</div><h2>On the wall.</h2></div><span>{polls.length} live</span></div>{polls.length > 0 && <div className="poll-admin-list">{polls.map((poll) => <div className="poll-admin-mini" key={poll.id}><strong>{poll.question}</strong><span>{poll.totalVotes} anonymous {poll.totalVotes === 1 ? 'vote' : 'votes'}</span><div className="poll-admin-mini-actions"><button className="ghost-button" onClick={() => sharePoll(poll)}><Share2 size={13} /> share</button><button className="ghost-button poll-delete-button" onClick={() => deletePoll(poll)} disabled={deleteBusy === `poll-${poll.id}`}><Trash2 size={13} /> {deleteBusy === `poll-${poll.id}` ? 'deleting' : 'delete'}</button></div></div>)}</div>}</section>

      <section className="admin-workspace page-width">
        <aside className="thread-browser">
          <div className="browser-head"><div><div className="eyebrow"><MessageCircle size={13} /> all threads</div><p>{visibleThoughts.length} {visibleThoughts.length === 1 ? 'conversation' : 'conversations'}</p></div><span className="live-dot"><i /> live</span><input className="thread-search" value={threadQuery} onChange={(event) => setThreadQuery(event.target.value)} placeholder="search threads" aria-label="Search threads" /></div>
          <div className="thread-list">
            {visibleThoughts.map((item) => <button key={item.id} onClick={() => openThought(item)} className={`thread-item ${selected?.id === item.id ? 'active' : ''}`}>
              <div className="thread-item-top"><span>{item.senderName || 'Anonymous'}</span>{item.unread && <b>new</b>}</div>
              <p>{item.text}</p><div><span>{item.replies.length} {item.replies.length === 1 ? 'reply' : 'replies'} · {item.upvotes ?? 0} votes</span><span>{formatTime(item.time)}</span></div>
            </button>)}
            {!visibleThoughts.length && <div className="empty-browser"><MessageCircle size={20} /><strong>{showKeeps ? 'No keepsakes yet' : 'Your inbox is empty'}</strong><span>New anonymous messages will appear here.</span></div>}
          </div>
        </aside>

        <section className="conversation-shell">
          {!selected ? <div className="conversation-empty"><div className="empty-icon"><MessageCircle size={23} /></div><h2>Choose a conversation</h2><p>Select a message from the left to open its thread.</p></div> : <div className="conversation-card">
            <div className="conversation-head"><div><div className="eyebrow"><Zap size={13} /> thread</div><h2>{selected.senderName || 'Anonymous'}</h2><p>{selected.replies.length} {selected.replies.length === 1 ? 'reply' : 'replies'} · {selected.upvotes ?? 0} votes · {formatTime(selected.time)}</p></div><div className="conversation-actions"><button className="icon-action" onClick={() => shareThread(selected)} title="Share this thread" aria-label="Share this thread">{copied ? <Check size={15} /> : <Share2 size={15} />}</button><button className="icon-action" onClick={() => toggleKeep(selected.id)} title={selected.kept ? 'Remove from keepsakes' : 'Keep thread'}><Star size={15} fill={selected.kept ? 'currentColor' : 'none'} /></button><button className="delete-thread-button" onClick={() => deleteThought(selected.id)} disabled={deleteBusy === `thread-${selected.id}`}><Trash2 size={14} /> {deleteBusy === `thread-${selected.id}` ? 'deleting' : 'delete thread'}</button></div></div>
            <div className="conversation-scroll">
              <article className="chat-bubble incoming"><div className="bubble-meta"><span>{selected.senderName || 'Anonymous'}</span><span>{formatTime(selected.time)}</span></div><p>{selected.text}</p></article>
              {selected.replies.map((reply) => <article key={reply.id} className={`chat-bubble ${reply.author === 'Fowzan' ? 'outgoing' : 'incoming'}`}><div className="bubble-meta"><span>{reply.author === 'Fowzan' ? 'Fowzan' : reply.author}</span><span>{formatTime(reply.time)}</span></div>{reply.mediaUrl && <a className="reply-media" href={reply.mediaUrl} target="_blank" rel="noreferrer"><img src={reply.mediaUrl} alt={reply.mediaType === 'gif' ? 'GIF attached by Fowzan' : 'Image attached by Fowzan'} loading="lazy" decoding="async" /></a>}{reply.text && <p>{reply.text}</p>}<button className="bubble-delete" onClick={() => deleteReply(selected.id, reply.id)} disabled={deleteBusy === `reply-${reply.id}`} title="Remove only this reply" aria-label="Remove only this reply"><Trash2 size={11} /> {deleteBusy === `reply-${reply.id}` ? 'deleting' : 'remove reply'}</button></article>)}
            </div>
            <div className="reply-dock"><div className="reply-composer"><input ref={replyInputRef} value={ownerReplies[selected.id] ?? ''} onChange={(e) => { const value = e.target.value; setOwnerReplies((c) => ({ ...c, [selected.id]: value })); localStorage.setItem(`fowzan-draft-${selected.id}`, value) }} placeholder="Write a reply as Fowzan…" maxLength={1000} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitOwnerReply(selected.id) } }} /><button onClick={() => submitOwnerReply(selected.id)} disabled={(!ownerReplies[selected.id]?.trim() && !ownerMediaUrls[selected.id]?.trim()) || replySending === selected.id}>{replySending === selected.id ? <Loader2 size={17} className="spin" /> : <Send size={16} />}</button></div><div className="media-reply-tools"><button className={ownerMediaModes[selected.id] === 'image' ? 'active' : ''} onClick={() => setOwnerMediaModes((current) => ({ ...current, [selected.id]: current[selected.id] === 'image' ? null : 'image' }))}><ImageIcon size={13} /> image</button><button className={ownerMediaModes[selected.id] === 'gif' ? 'active' : ''} onClick={() => setOwnerMediaModes((current) => ({ ...current, [selected.id]: current[selected.id] === 'gif' ? null : 'gif' }))}><Film size={13} /> GIF</button>{ownerMediaModes[selected.id] && <input value={ownerMediaUrls[selected.id] ?? ''} onChange={(event) => setOwnerMediaUrls((current) => ({ ...current, [selected.id]: event.target.value }))} placeholder={`Paste a ${ownerMediaModes[selected.id]} URL…`} inputMode="url" />}</div><div className="composer-foot"><span>{ownerReplies[selected.id] || ownerMediaUrls[selected.id] ? 'Draft saved on this device · Enter to send' : 'R reply · S save · J/K browse · Esc close'}</span><span>{(ownerReplies[selected.id] ?? '').length}/1000</span></div></div>
          </div>}
        </section>
      </section>

      <section className="queue-section page-width"><div className="queue-head"><div><div className="eyebrow"><PenLine size={13} /> quick reply queue</div><h2>Threads waiting on you.</h2></div><span>{waitingCount} waiting</span></div><div className="queue-grid">{thoughts.filter((item) => item.replies.length === 0).map((item) => <button key={item.id} className="queue-item" onClick={() => openThought(item)}><span>{item.senderName || 'Anonymous'}</span><p>{item.text}</p><b>reply <ChevronRight size={13} /></b></button>)}{waitingCount === 0 && <div className="queue-clear"><Check size={17} /> You're all caught up.</div>}</div></section>
    </main>
  )

  return (
    <main className="app-page public-page" data-theme={theme}>
      <div className="cyber-bg" aria-hidden="true"><i /><i /><i /><div className="space-stars">{Array.from({ length: 72 }, (_, index) => <span key={index} style={{ top: `${(index * 47) % 100}%`, left: `${(index * 73 + 11) % 100}%`, animationDelay: `${-(index % 17) * 0.42}s`, animationDuration: `${4.5 + (index % 7) * 0.8}s` }} />)}</div><div className="asteroid-field">{Array.from({ length: 10 }, (_, index) => <i key={index} style={{ top: `${(index * 31 + 8) % 94}%`, left: `${(index * 61 - 12) % 112 - 4}%`, animationDelay: `${-(index % 9) * 1.15}s`, animationDuration: `${18 + (index % 6) * 2.1}s`, transform: `scale(${0.7 + (index % 5) * 0.22}) rotate(${(index * 23) % 360}deg)` }} />)}</div>{matrixStreams.slice(0, 12).map((stream, index) => <b key={index}>{Array.from(stream).map((char, charIndex) => <span key={charIndex}>{char}</span>)}</b>)}</div><div className="ambient-orb orb-a" /><div className="ambient-orb orb-b" /><div className="ambient-orb orb-d" /><div className="grain" />
      <div className="particle-field" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
      <header className="topbar public-topbar"><button className="brand wordmark" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Mail size={16} /> FOWZAN&apos;S INBOX</button><div className="topbar-controls"><label className="theme-picker"><span>THEME</span><select aria-label="Choose color theme" value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}><option value="purple">PURPLE</option><option value="green">GREEN</option><option value="red">RED</option><option value="blue">BLUE</option><option value="rose">ROSE</option><option value="white">WHITE</option></select></label><button className="private-button" onClick={() => setView('private')}><LockKeyhole size={14} /> private inbox</button></div></header>

      <section className="public-hero page-width">
        <div className="hero-badge"><span /> ANONYMOUS MESSAGES TO FOWZAN</div>
        <h1>SEND FOWZAN<br /><em>A MESSAGE.</em></h1>
        <p className="hero-lead">Say whatever you want to say. Ask a question, leave a thought, or just check in. Your name stays hidden unless you choose to add it.</p>
        <div className="hero-actions"><a href="#leave-message" className="primary-button">send a message <ChevronRight size={17} /></a><button className="secondary-button" onClick={sharePage}>{copied ? <Check size={15} /> : <Share2 size={15} />} {copied ? 'link copied' : "share Fowzan's inbox"}</button></div>
      </section>

      <section id="leave-message" className="composer-section page-width"><div className="section-intro"><div className="eyebrow"><PenLine size={13} /> MESSAGE FOWZAN</div><h2>WHAT DO YOU<br /><span>WANT TO SEND?</span></h2></div>
        <div className="message-composer"><div className="composer-label"><span className="pulse-dot" /> YOUR ANONYMOUS MESSAGE</div><textarea value={thought} onChange={(e) => setThought(e.target.value)} placeholder="Send Fowzan a thought, question, or message..." rows={5} maxLength={500} /><div className="composer-meta"><span>{thought.length}/500</span><span>your name is hidden</span></div></div>
        <div className="identity-controls"><label><input type="checkbox" checked={revealName} onChange={(e) => setRevealName(e.target.checked)} /><span className="switch" /> include my name</label>{revealName && <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="display name" maxLength={80} />}</div>
        <button className="primary-button send-button" onClick={submitThought} disabled={!thought.trim() || sending}>{sending ? <><Loader2 size={16} className="spin" /> sending…</> : <>Send to Fowzan <Send size={16} /></>}</button>
      </section>

      <section className="prompt-section page-width"><div className="section-intro compact"><div className="eyebrow"><Sparkles size={13} /> NOT SURE WHAT TO ASK?</div><h2>START HERE.</h2></div><div className="prompt-grid">{prompts.map((prompt, index) => <button key={prompt} onClick={() => { setThought(prompt); document.getElementById('leave-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><span>0{index + 1}</span>{prompt}<ChevronRight size={14} /></button>)}</div></section>

      {error && <div className="error-banner page-width">{error}</div>}

      <section className="public-threads page-width"><div className="chat-board-section threads-board-section"><div className="chat-board-heading"><div><div className="eyebrow"><MessageCircle size={13} /> CHAT BOARD</div><h3>Open conversations.</h3></div><span>{responses.length} live</span></div><div className="threads-heading"><div><div className="eyebrow"><MessageCircle size={13} /> FOWZAN&apos;S REPLIES</div><h2>REPLY BOARD.</h2><p>Messages Fowzan chooses to answer appear here — and you can keep the conversation going.</p><small className="thread-contribute-hint">Have something to add? Join the thread and contribute your own reply.</small></div><span>{responses.length} live</span></div></div>
        {polls.length > 0 && (
          <div className="public-poll-list">
            {polls.map((poll) => (
              <article className="public-poll" key={poll.id}>
                <div className="poll-meta">
                  <span><BarChart3 size={13} /> ANONYMOUS POLL</span>
                  <button onClick={() => sharePoll(poll)} aria-label="Share this poll">
                    <Share2 size={14} />
                  </button>
                </div>
                <h3>{poll.question}</h3>
                {poll.imageData && <img className="poll-wall-image" src={poll.imageData} alt="Poll visual" loading="lazy" />}
                <div className="poll-options">
                  {poll.options.map((option, index) => {
                    const total = poll.totalVotes || 0
                    const pct = total ? Math.round(((poll.counts[index] ?? 0) / total) * 100) : 0
                    const voted = votedPolls[poll.id] !== undefined
                    const selected = votedPolls[poll.id] === index

                    return (
                      <button
                        key={`${poll.id}-${index}`}
                        className={`poll-option ${voted ? 'show-result' : ''} ${selected ? 'selected' : ''}`}
                        onClick={() => votePoll(poll, index)}
                        disabled={voted}
                      >
                        <span className="poll-option-label">{option}</span>
                        {voted && (
                          <>
                            <i style={{ width: `${pct}%` }} />
                            <b>{pct}%</b>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="poll-foot">
                  <span>{poll.totalVotes} anonymous {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
                  <span>{formatTime(poll.time)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
        {loading ? <div className="loading-card"><Loader2 size={19} className="spin" /> loading Fowzan&apos;s replies…</div> : <div className="public-thread-list">{responses.map((response) => <article key={response.id} className="public-thread"><div className="thread-meta"><span><i /> {response.author}</span><span>{formatTime(response.time)}</span></div><h3>{response.text}</h3>{response.replies.length > 0 && <div className="public-replies">{response.replies.map((reply) => <div key={reply.id}><div><b className={reply.author === 'Fowzan' ? 'fowzan' : ''}>{reply.author}</b><span>{formatTime(reply.time)}</span></div>{reply.mediaUrl && <a className="reply-media" href={reply.mediaUrl} target="_blank" rel="noreferrer"><img src={reply.mediaUrl} alt={reply.mediaType === 'gif' ? 'GIF attached by Fowzan' : 'Image attached by Fowzan'} loading="lazy" decoding="async" /></a>}{reply.text && <p>{reply.text}</p>}</div>)}</div>}<div className="public-thread-foot"><span>{response.replies.length} {response.replies.length === 1 ? 'reply' : 'replies'}</span><div><button className={`upvote-button ${votedThreadIds.has(response.id) ? 'voted' : ''}`} onClick={() => toggleUpvote(response.id)} aria-pressed={votedThreadIds.has(response.id)}><ThumbsUp size={14} /> {response.upvotes ?? 0}</button><button onClick={() => shareThread(response)}><Share2 size={14} /> share</button><button onClick={() => setReplyingTo(replyingTo === response.id ? null : response.id)}><MessageCircle size={14} /> join thread</button></div></div>{replyingTo === response.id && <div className="public-reply-form"><div className="reply-composer"><input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Add to the conversation…" maxLength={1000} /><button onClick={() => submitReply(response.id)} disabled={!replyText.trim()}><Send size={15} /></button></div><label><input type="checkbox" checked={replyReveal} onChange={(e) => setReplyReveal(e.target.checked)} /> show my name</label>{replyReveal && <input value={replyName} onChange={(e) => setReplyName(e.target.value)} placeholder="display name" maxLength={80} />}</div>}</article>)}{!responses.length && <div className="empty-browser public-empty"><MessageCircle size={20} /><strong>Fowzan has not replied yet.</strong><span>Come back soon to see messages Fowzan chooses to answer.</span></div>}</div>}
        </section>

      {sent && <div className="modal-backdrop" onClick={() => setSent(false)}><article className="success-modal" onClick={(e) => e.stopPropagation()}><div className="success-icon"><Check size={21} /></div><div className="eyebrow">message delivered</div><h2>That was sent.</h2><p>Your message is safely in Fowzan's inbox. Leave another whenever you feel like it.</p><button className="primary-button" onClick={() => setSent(false)}>Send another <ChevronRight size={17} /></button></article></div>}
    </main>
  )
}

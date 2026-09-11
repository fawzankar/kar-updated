'use client'

import { Share2 } from 'lucide-react'

export default function ShareThreadButton() {
  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: "A thread from Fowzan's Inbox", url })
      else await navigator.clipboard.writeText(url)
    } catch { /* User cancelled sharing. */ }
  }

  return <button onClick={share} aria-label="Share this thread" title="Share this thread"><Share2 size={15} /></button>
}

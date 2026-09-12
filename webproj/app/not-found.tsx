import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-stars" aria-hidden="true">
        {Array.from({ length: 55 }, (_, i) => <i key={i} style={{ top: `${(i * 37) % 100}%`, left: `${(i * 61 + 7) % 100}%`, animationDelay: `${-(i % 12) * .45}s` }} />)}
      </div>
      <div className="not-found-orb orb-one" />
      <div className="not-found-orb orb-two" />
      <div className="not-found-card">
        <div className="not-found-code">404</div>
        <div className="not-found-eyebrow"><span /> SIGNAL LOST</div>
        <h1>This page drifted<br /><em>off the map.</em></h1>
        <p>Looks like this link took a wrong turn through space. The inbox is still right here.</p>
        <Link className="not-found-button" href="/">Return to Fowzan&apos;s Inbox <span>→</span></Link>
        <div className="not-found-mark">FOWZAN // INBOX</div>
      </div>
    </main>
  )
}

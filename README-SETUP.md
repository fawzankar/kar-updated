# Fowzan's Inbox

A teen-cyberpunk anonymous-message website: almost-black panels, hot red and acid-green accents, pixel-display typography, and a visible animated grid/particle background. It retains the anonymous messaging, threaded replies, owner authentication, moderation, and database behavior from the original project.

## Run locally

1. Copy `.env.example` to `.env.local` and provide the listed environment variables.
2. Run `npm install`.
3. Run `npm run dev`.

## Design highlights

- Responsive black-and-green cyberpunk layout with an animated perspective grid, visible Matrix rain, and minimal drifting particles.
- Pixel-style display font for major headings and a compact technical mono font for interface content.
- Tactile hover states, sharp arcade-inspired cards, and accessible reduced-motion support.
- A built-in Green / Red / Blue / Yellow theme selector on the public page.
- A private inbox for reading, replying to, saving, and managing threads.

## Original functional behavior

This build keeps every incoming message as its own conversation thread.

## Included
- All incoming questions appear in **All Threads**.
- The selected thread has its own bounded internal scroll area, so long conversations do not break the page.
- Fowzan can send unlimited replies in the same thread.
- One click/request creates one reply; the reply button is locked while a reply is being sent.
- The owner can remove any individual reply without affecting its parent thread.
- Deleting an entire thread is a separate, confirmed action; it removes the original message and its replies.
- Deleting a thread removes its replies first, then the thread itself.
- New messages are refreshed automatically while the private inbox is open.
- Reply Queue shows threads that have not received a reply yet.
- Existing authentication and public anonymous-message functionality are preserved.

## Vercel environment variables
Use your existing variables. The database connection prefers `STORAGE_DATABASE_URL` (from Vercel Storage/Neon) and falls back to `DATABASE_URL`.

Required owner variables:
- `OWNER_PASSWORD`
- `AUTH_SECRET`

Do not commit `.env` or `.env.local`.

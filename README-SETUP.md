# FOWZAN // PLAYER SIGNAL

A black, neon-green, and red arcade-inspired social signal board. It retains the anonymous messaging, threaded replies, owner authentication, moderation, and database behavior from the original project.

## Run locally

1. Copy `.env.example` to `.env.local` and provide the listed environment variables.
2. Run `npm install`.
3. Run `npm run dev`.

## Revamp highlights

- Responsive arcade command-center layout with an animated scanline/grid background.
- Bold gaming-focused hero, prompts, terminology, metadata, and success feedback.
- Red/green glow states, tactile hover effects, elevated conversation cards, and accessible reduced-motion support.
- Owner inbox reskinned as a private Signal Control console; all underlying owner workflows remain intact.

## Original functional behavior

This build keeps every incoming message as its own conversation thread.

## Included
- All incoming questions appear in **All Threads**.
- The selected thread has its own bounded internal scroll area, so long conversations do not break the page.
- Fowzan can send unlimited replies in the same thread.
- One click/request creates one reply; the reply button is locked while a reply is being sent.
- The owner can delete an entire thread or any individual reply/comment.
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

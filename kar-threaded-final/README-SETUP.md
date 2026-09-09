# Fowzan Inbox — threaded inbox build

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

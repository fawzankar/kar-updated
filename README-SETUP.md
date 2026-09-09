# Updated inbox setup

This build removes the old “Dear you” concept and adds server-backed messages, protected owner authentication, public/owner separation, validation, rate limiting, improved responsive UI, and refined interactions.

In Vercel → Project → Settings → Environment Variables, add:
- DATABASE_URL = your Neon connection string
- OWNER_PASSWORD = the password you want for the private inbox
- AUTH_SECRET = a long random secret
- NEXT_PUBLIC_SITE_URL = your deployed Vercel URL

Do not upload or commit `.env` / `.env.local`.
The database tables are created automatically on the first API request.

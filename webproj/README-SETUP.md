# Fowzan's Inbox — multi-user setup

This version supports a private account for the owner plus additional private inbox accounts. Every account has its own inbox, replies, read/keep state, and password-change flow.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` (or `STORAGE_DATABASE_URL`) to your Postgres/Neon connection string.
3. Set a strong `OWNER_PASSWORD` and a random `AUTH_SECRET` (32+ characters).
4. Install dependencies with `npm install`.
5. Run `npm run dev`.

## Creating the 13 additional accounts

Run:

```bash
node scripts/generate-users.mjs 13
```

The script prints 13 unique usernames and strong random passwords as JSON. Put that JSON in the `INITIAL_USERS_JSON` environment variable for the first deployment.

Example shape:

```json
[{"username":"user01","displayName":"User 01","password":"..."},{"username":"user02","displayName":"User 02","password":"..."}]
```

On first schema initialization, the passwords are converted to salted scrypt password hashes before being stored in Postgres. The application does not store the plaintext passwords. **After the accounts have been created successfully, remove `INITIAL_USERS_JSON` from Vercel/environment variables.** Users can then change their own passwords from their private admin panel.

Usernames are lowercase and may contain letters, numbers, `.`, `_`, and `-`.

## Sharing each person's inbox

Each person gets a public inbox URL in this format:

`https://your-domain.example/user01`

Each public inbox has a clean URL such as `https://your-domain.example/user01`. The owner/admin's public inbox is `https://your-domain.example/fowzan` by default. The private admin's **share** button automatically creates the correct clean URL for the signed-in account.

## Security model

- Passwords are salted and hashed with Node's scrypt; plaintext passwords are not stored in the database.
- Login sessions use random opaque tokens stored only as SHA-256 hashes in Postgres.
- Sessions are HttpOnly, SameSite=Lax cookies and use Secure cookies in production.
- Password changes invalidate all active sessions for that account.
- Every private inbox query is scoped by the authenticated user's database ID.
- Replies, read/keep actions, and deletes verify that the target message belongs to the authenticated account.
- Poll creation/deletion remains owner-only.
- Public anonymous submissions are routed to the selected account via the `to` parameter/body recipient.
- Existing messages are migrated to the configured owner account during the first schema initialization.

## Important deployment note

Do not commit `.env`, `.env.local`, or an `INITIAL_USERS_JSON` containing plaintext passwords to GitHub. Prefer Vercel environment variables for first-run provisioning, then remove the provisioning variable after the database has been initialized.

## Owner user management

After the initial users have been provisioned, sign in with the owner account and use **users** in the private inbox toolbar. The owner-only panel can:

- list every account with message/unread counts;
- inspect any user's inbox without logging in as that user;
- copy/open that user's public inbox URL;
- disable or re-enable a user's login (disabling also revokes their sessions);
- reset a user's password to a strong random password, shown once in the owner panel.

The owner account itself cannot be disabled or reset from this panel. Users can still change their own password from **password** in their private inbox.

Public inbox URLs use `/<username>` and messages submitted there are stored against that username's database account. Conversation shares use `/<username>/thread/<messageId>`. The older `/?to=<username>` form remains supported as a compatibility fallback.


## Clean URL routing

Each account now has a human-friendly public URL: `https://your-domain.example/<username>` (for example, `/user01`). Shared conversations use `https://your-domain.example/<username>/thread/<messageId>`. The previous `/?to=<username>` URLs are accepted for compatibility and automatically cleaned to the new URL in the browser.

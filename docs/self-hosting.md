# Self-hosting

Running this for yourself, or for a team.

## Requirements

- **Node 20+**
- **PostgreSQL 14+** — the repo ships a Postgres 17 container, but any Postgres
  works
- Somewhere to run a long-lived Node process. The SSE stream means serverless
  platforms that cap request duration are a poor fit.

Nothing else. No Redis, no queue, no object storage — avatars are stored as bytes
in Postgres and thumbnailed in the browser before upload.

## Environment

Two variables, both required:

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | Signs the session cookie **and** derives the key that encrypts stored API keys |

Both are read at import time — `db.server.ts` and `session.server.ts` throw on
boot if either is missing, rather than failing on the first request.

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Rotating `SESSION_SECRET`

It does two jobs, so rotating it does two things:

1. Everyone is signed out.
2. Stored API keys become unreadable.

The second is handled gracefully — an undecryptable key is treated as "no key
set", so the app keeps working and asks each person to paste theirs again. Nothing
crashes, but tell your users first.

## Deploying

```bash
npm ci
npm run db:generate          # build the Prisma client
npx prisma migrate deploy    # apply migrations
npm run build
npm start                    # serves build/server/index.js on $PORT (default 3000)
```

A `Dockerfile` is included and builds a production image with no extra
configuration.

Put it behind TLS. The session cookie sets `secure: true` when
`NODE_ENV=production`, so it will not be sent over plain HTTP.

### Running more than one instance

The event bus in `app/lib/events.server.ts` is **in-process**. Two instances behind
a load balancer will each serve live updates only to the tabs connected to them,
so a change made on instance A never reaches a tab attached to instance B.

Fixing it is a contained change: swap `emit` and `subscribe` for a shared
transport — Postgres `LISTEN/NOTIFY` is the obvious choice since you already have
Postgres — and nothing else in the app has to change.

Until then, run one instance.

## API keys: why there is no server-wide key

Every AI call uses the key belonging to the person who triggered it, stored on
their profile. There is no `OPENAI_API_KEY` environment variable and no fallback.

This is deliberate:

- **Cost.** A shared key means whoever hosts the instance pays for everyone's idea
  generation, at `high` reasoning effort, indefinitely. That is the single most
  common reason self-hosted AI tools get switched off.
- **Blast radius.** One key in one env var, used by every user, is one leak away
  from being someone else's problem. Per-user keys fail small.
- **Choice.** People pick their own model and reasoning effort, so someone can run
  `low` on a cheap model while a colleague runs `high`.

### How keys are stored

- Encrypted with **AES-256-GCM** before they touch the database, using a key
  derived from `SESSION_SECRET` via SHA-256 (`app/lib/secrets.server.ts`).
- Stored as `v1:<iv>:<authTag>:<ciphertext>`, all base64url. GCM means a tampered
  row fails to decrypt rather than decrypting to garbage.
- **Never sent to the browser.** Loaders expose only `hasKey`, the last four
  characters, and the date it was saved. The profile form's key input is never
  pre-filled; leaving it blank keeps the existing key.
- Decryptable by anyone with both the database and `SESSION_SECRET`. That is the
  honest limit of this design: it protects against a leaked database dump, not
  against a compromised server.

### Onboarding your users

Point them at **Profile → AI provider**. Until they add a key, every AI surface
tells them so and links straight there — no silent failures, and the rest of the
app (board, editor, comments, analytics, live updates) works normally without one.

## Backups

Everything is in Postgres, including avatars. A normal `pg_dump` is a complete
backup.

Note that a dump contains encrypted API keys. Restoring it onto an install with a
different `SESSION_SECRET` leaves those keys unreadable — which is usually the
behaviour you want.

## What this app talks to

Useful to know if you run it in a locked-down network. Outbound requests go to:

- your database
- `api.openai.com`, using the calling user's key
- **article URLs users paste in**, and same-origin sub-pages of a site when
  profiling a project from it

That is the complete list. There is no analytics, telemetry, error reporting or
update check of any kind, and no third-party scripts are loaded in the browser.

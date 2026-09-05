# Security

## Reporting a vulnerability

Please report security issues privately rather than in a public issue — use
GitHub's **Report a vulnerability** button under the Security tab. A short
description of the problem and how to reproduce it is enough to get started.

Please do not open a public issue, post a working exploit, or test against an
instance you do not own.

## What this app protects, and how

**Passwords** are hashed with scrypt (`node:crypto`) and stored as
`scrypt:<salt>:<hash>`. Verification is constant-time.

**Sessions** are signed cookies — `httpOnly`, `sameSite: lax`, and `secure` when
`NODE_ENV=production`. A cookie pointing at a deleted user is destroyed rather
than looped through the login page.

**Authorization** runs through `app/lib/workspace.server.ts` on every loader and
action. A user who is not a member of a workspace gets a **404, not a 403**, so
existence is never leaked. Resource routes under `/api/*` re-resolve any id they
receive in a form body rather than trusting it.

**API keys** are encrypted at rest with AES-256-GCM before they reach the
database, using a key derived from `SESSION_SECRET` (`app/lib/secrets.server.ts`).
They are never sent to the browser — loaders expose only whether a key exists, its
last four characters, and when it was saved. This protects against a leaked
database dump; it does not protect against a compromised server, which has both
the ciphertext and the secret.

**Error pages** render an exception's message and stack only in development. Those
branches are compiled out of the production bundle. In production every unexpected
error renders a generic message.

**Avatars** are served by `/avatar/:userId` only to workspace peers of the user in
question.

## Known limits

- The event bus is in-process, so live updates do not cross instances. See
  [docs/self-hosting.md](docs/self-hosting.md).
- Article fetching (`fetchArticle` / `crawlSite`) requests URLs supplied by
  authenticated users. It follows redirects and does not block private address
  ranges, so an authenticated user can make the server issue requests to hosts it
  can reach. If you run this somewhere with sensitive internal services, put it on
  a network segment that cannot reach them, or front outbound fetches with a
  proxy that blocks private ranges.
- There is no rate limiting on authentication or on AI routes. AI routes spend the
  caller's own API credit, which limits the incentive, but a public sign-up
  instance should sit behind a reverse proxy that rate-limits `/login` and
  `/signup`.

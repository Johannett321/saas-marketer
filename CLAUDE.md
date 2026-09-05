# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev         # scripts/setup.mjs then react-router dev → http://localhost:5173
npm run setup       # just the setup: .env, Postgres, migrate deploy, prisma generate
npm run typecheck   # react-router typegen + tsc — the only automated check in the repo
npm run build       # production build; npm start serves build/server/index.js

npm run db:seed             # rebuild the demo workspace (scripts/seed.ts)
npm run db:up / db:down     # Postgres 17 in Docker on port 5433 (not 5432)
npm run db:migrate          # prisma migrate dev
npm run db:reset / db:studio
npm run db:generate         # regenerate the client into app/generated/prisma
```

`scripts/setup.mjs` is the single entry point for "make this bootable": it creates `.env` with a
generated `SESSION_SECRET` when missing, brings up Postgres (skipped when `DATABASE_URL` does not
point at `localhost:5433`), waits for it, runs `prisma migrate deploy`, and regenerates the client
when it is older than the schema. Every step is idempotent — a fresh clone is `npm install &&
npm run dev`.

There is no test runner and no linter. Verification is `npm run typecheck`, which fails unless
the Prisma client and route types have been generated — run `npm run db:generate` after touching
`prisma/schema.prisma` and let typegen run before trusting a `tsc` error about `./+types/*`.

`db.server.ts` and `session.server.ts` throw at import time when `DATABASE_URL` / `SESSION_SECRET`
are missing, but `npm run dev` writes a working `.env` first, so this only bites when someone edits
it. `SESSION_SECRET` also derives the AES key that encrypts stored API keys — rotating it signs
everyone out *and* makes stored keys unreadable (handled as "no key set", not an error).

There is **no `OPENAI_API_KEY`**. AI credentials are per user; see "AI flows" below.

## Stack essentials

- **React Router v8 framework mode**, SSR on. Routes are declared explicitly in `app/routes.ts`
  (not file-based); each route imports its generated types from `./+types/<route-name>`.
- **Prisma 7 with the `@prisma/adapter-pg` driver adapter.** The client is generated to
  `app/generated/prisma` (gitignored). Import models/enums from `~/generated/prisma/enums` and
  `~/generated/prisma/client` — **never** from `@prisma/client`. The datasource URL lives in
  `prisma.config.ts` (which loads dotenv), not in `schema.prisma`.
- **Tailwind v4 + daisyUI 5.** The `saasmarketer` theme and the `brand-*`, `ink-*`, `stage-*`
  color scales are defined in `app/app.css`. Use those tokens; don't introduce raw hex or stock
  Tailwind grays. `data-theme` is set on `<html>` in `root.tsx`.
- Path alias `~/*` → `app/*`.
- `.agents/skills/` holds vendored React Router and Prisma reference docs. It is gitignored — local
  tooling, not part of the published repo.

## Architecture

### Access control — every loader and action starts here

`app/lib/workspace.server.ts` is the only gate. `requireUser(request)` (session.server) then one of
`requireWorkspace` / `requireProject` / `requireProjectById` / `requireCard`, all of which `throw
data(..., { status: 404 })` when the user has no membership — non-members get 404, not 403, so
existence isn't leaked. Role rank is `MEMBER < ADMIN < OWNER`; pass `minRole` to `requireWorkspace`
for privileged actions. Resource routes under `/api/*` take an id from the form body, so they must
resolve it through `requireProjectById` / `requireCard` rather than trusting the id.

### Mutations: one action per route, dispatched on `intent`

Every route action reads `form.get("intent")`, switches, and ends with
`throw data("Unknown intent", { status: 400 })`. Forms carry `<input type="hidden" name="intent">`;
client-side callers use `fetcher.submit({ intent, ... })`.

### Activity, live updates and analytics are coupled

- **Any user-visible card change must go through `recordActivity()`** (`app/lib/activity.server.ts`).
  It is the single write path: it appends the `Activity` row shown in the card's history *and*
  broadcasts the same fact over SSE. Skipping it means the change is invisible to other tabs.
- Adding an `ActivityType` requires four edits or it breaks at runtime: the enum in
  `schema.prisma` (+ migration), `ACTIVITY_COPY` in `app/lib/activity.ts` (shared phrasing for both
  the toast and the history line), and the `KIND` map in `activity.server.ts`.
- **Card moves must go through `moveCard()`** (`app/lib/cards.server.ts`). Positions are floats with
  a gap of 1000 and midpoint insertion, and the function writes the `StatusEvent` row. Analytics
  (`workspace-analytics.tsx`) counts "videos produced" from `StatusEvent` rows reaching
  `READY_TO_PUBLISH`/`SCHEDULED` and "scripts written" from `ScriptRevision`, so a direct
  `db.videoCard.update({ status })` silently drops the card out of the numbers.
- Script writes go through `saveRevision()` in `api.script.tsx`, which updates the card and appends
  a `ScriptRevision` in one transaction.

`app/lib/events.server.ts` is an **in-process** pub/sub keyed by workspace id, behind
`/api/stream/:workspaceSlug` (SSE, 25s keepalive). `<Realtime>` in `app-layout.tsx` opens one
connection per tab, revalidates on every event (debounced 120ms to coalesce bursts) and only toasts
events whose `actor.id` isn't the current user. Multi-instance deployment would need a shared bus —
swap `emit`/`subscribe` and nothing else changes.

### AI flows

Everything OpenAI lives in `app/lib/ai.server.ts` (Responses API, `web_search` tool, strict
`json_schema` outputs).

**Credentials are per user, never per instance.** Every exported function takes an `AiCredentials`
(`{ apiKey, model, reasoningEffort }`) as its *first* argument, loaded from the caller's profile by
`loadAiCredentials(userId)` in `ai-credentials.server.ts`. It returns null when there is no usable
key, and routes turn that into `MISSING_KEY_MESSAGE` from `app/lib/ai.ts` (a non-`.server` file, so
the profile form can share the constants). Keys are encrypted with AES-256-GCM in
`secrets.server.ts` using a key derived from `SESSION_SECRET`, and loaders only ever expose
`hasKey` / last four characters / date. A new AI route must follow the same shape. The UI side is
`useHasAiKey()` / `<AiKeyNotice>` in `app/components/ai-key-notice.tsx`, fed by `hasAiKey` on the
`app-layout` loader.

Two more hard rules:

1. **Prompts stay vertical-agnostic.** The only domain knowledge allowed in a prompt is the
   project's own `niche` and `description`, assembled by `projectBrief()`. Don't hardcode an
   industry, product or audience.
2. **Calls are slow, so they run in resource routes, never in a page loader.** `/api/ideas`,
   `/api/script`, `/api/title`, `/api/project-profile` are POST-only (their loaders 404) and are
   invoked with `useFetcher`. `<WaitingGame>` (Spark Catcher, scores in `GameScore`) is what the
   user sees during the wait — it exists because the calls take tens of seconds.

Idea generation persists an `IdeaBatch` + `IdeaSuggestion` rows first; accepting a suggestion is a
separate `intent: "accept"` that creates the card and stamps `usedCardId`. Article context captured
at idea time (`sourceUrl`/`sourceTitle`/`sourceExcerpt`) rides onto the card and is reused when the
script is generated; if it's missing but a URL is present, `api.script.tsx` fetches the article once
and caches the excerpt on the card.

### Navigation shell

`app-layout` (top bar, workspace switcher, `<Realtime>`) wraps two sibling layouts that render the
same `<Sidebar>` shell with different items: `workspace-layout` (Projects / Analytics / Members) and
`project-layout` (Kanban / Settings). Because the frame is identical, moving between levels swaps
items in place. Breadcrumbs are collected by `useCrumbs()` from each matched route's
`handle.breadcrumb(loaderData)` export — a route that should appear in the trail must export one.
The card detail route is nested inside `project-board`, rendered as a drawer over the board via
`<Outlet />`.

### Smaller conventions worth knowing

- Passwords use scrypt via `node:crypto` (`auth.server.ts`), stored as `scrypt:<salt>:<hash>`.
- Avatars: uploaded bytes live on `User` and are served by `/avatar/:userId` with an ETag derived
  from `avatarUpdatedAt`, readable only by workspace peers. The `<Avatar>` component needs
  `avatarUpdatedAt` (and `avatarHue`, `name`, `id`) — **select those fields in any query whose
  result gets rendered as an avatar**, or uploaded pictures silently fall back to initials.
- The five kanban columns are defined once in `app/lib/stages.ts` (`STAGES` / `STAGE_BY_ID`),
  including their labels and color tokens; the `CardStatus` enum must stay in sync.
- Scripts are stored as markdown. The editor is tiptap with `tiptap-markdown` doing the round-trip
  (`script-editor.tsx`, `immediatelyRender: false` because the drawer server-renders first).
- Routes export `ErrorBoundary` returning `<RouteErrorPanel>`; `root.tsx` has the global fallback.
  Both render the raw message and stack **only** behind `import.meta.env.DEV`, so those branches are
  eliminated from the production bundle. Never render an exception unconditionally.
- `scripts/seed.ts` builds a fictional demo workspace (Northwind Studio) for screenshots and for
  trying the app. It deletes and rebuilds only that workspace, so it is safe to re-run.
- The repo carries no payments, analytics or telemetry of any kind, and the README says so. Do not
  add a third-party script, tracker or error reporter without raising it first.

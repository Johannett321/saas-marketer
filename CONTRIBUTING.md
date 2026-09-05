# Contributing

Thanks for taking a look. This is a small codebase with a few load-bearing
conventions — this document is mostly about those, because they are the things
that break silently if you miss them.

## Getting set up

```bash
npm install
npm run dev      # writes .env, starts Postgres, migrates, generates, serves
npm run db:seed  # optional: demo workspace to click around in
```

See the [README](README.md#getting-started) for details.

## The one automated check

```bash
npm run typecheck
```

There is no test runner and no linter. `typecheck` runs `react-router typegen`
followed by `tsc`, and it is what CI would run. It **fails unless the Prisma
client and the route types have been generated**, so:

- after editing `prisma/schema.prisma`, run `npm run db:migrate` (which
  regenerates the client), or `npm run db:generate` on its own;
- if `tsc` complains about `./+types/<route>`, let typegen finish before you
  believe the error.

Please make sure `npm run typecheck` is clean before opening a PR.

## Layout

```
app/
  lib/
    ai.server.ts             OpenAI calls: ideas, scripts, titles, project profiling
    ai.ts                    AI constants shared between client and server
    ai-credentials.server.ts loads the caller's own key, model and reasoning effort
    secrets.server.ts        AES-256-GCM encryption for stored API keys
    activity.ts              shared phrasing for the history timeline and live toasts
    activity.server.ts       single write path: append history + broadcast the event
    cards.server.ts          card moves and position maths
    db.server.ts             Prisma client (reused across HMR)
    events.server.ts         in-process pub/sub behind the SSE stream
    session.server.ts        cookie session and auth guards
    workspace.server.ts      access control for workspace / project / card
    stages.ts                the five columns
  components/                UI primitives, board card, idea generator, editor,
                             confirm dialog, breadcrumbs, sidebar shell, toasts
  routes/                    route modules — declared in app/routes.ts, not file-based
prisma/schema.prisma
scripts/setup.mjs            everything that must be true before the server boots
scripts/seed.ts              the demo workspace
docs/architecture.md         how the pieces fit together
```

Path alias: `~/*` → `app/*`.

## Conventions that will bite you

**Access control starts every loader and action.** `requireUser(request)` then one
of `requireWorkspace` / `requireProject` / `requireProjectById` / `requireCard`
from `app/lib/workspace.server.ts`. Non-members get a **404, not a 403**, so the
existence of a workspace is not leaked. Resource routes under `/api/*` take an id
from the form body, so they must resolve it through `requireProjectById` /
`requireCard` rather than trusting it.

**One action per route, dispatched on `intent`.** Every action reads
`form.get("intent")`, switches, and ends with
`throw data("Unknown intent", { status: 400 })`. Forms carry a hidden `intent`
input; client callers use `fetcher.submit({ intent, ... })`.

**Any user-visible card change must go through `recordActivity()`.** It is the
single write path: it appends the `Activity` row shown in the card's history *and*
broadcasts the same fact over SSE. Skipping it means the change is invisible to
other tabs.

**Adding an `ActivityType` takes four edits** or it breaks at runtime: the enum in
`schema.prisma`, a migration, `ACTIVITY_COPY` in `app/lib/activity.ts`, and the
`KIND` map in `activity.server.ts`.

**Card moves must go through `moveCard()`** in `app/lib/cards.server.ts`. It writes
the `StatusEvent` row that analytics counts. A direct
`db.videoCard.update({ status })` silently drops the card out of the numbers.

**Select the avatar fields.** `<Avatar>` needs `avatarUpdatedAt`, `avatarHue`,
`name` and `id`. Any query whose result gets rendered as an avatar must select
them, or uploaded pictures silently fall back to initials.

**Import Prisma types from the generated client**, never from `@prisma/client`:
`~/generated/prisma/enums` and `~/generated/prisma/client`.

**Use the theme tokens.** `brand-*`, `ink-*` and `stage-*` are defined in
`app/app.css`. No raw hex, no stock Tailwind grays.

## Working on the AI

Two hard rules in `app/lib/ai.server.ts`:

1. **Prompts stay vertical-agnostic.** The only domain knowledge allowed in a
   prompt is the project's own `niche` and `description`, assembled by
   `projectBrief()`. Never hardcode an industry, product or audience.
2. **Calls are slow, so they run in resource routes, never in a page loader.**
   `/api/ideas`, `/api/script`, `/api/title` and `/api/project-profile` are
   POST-only (their loaders 404) and are invoked with `useFetcher`.

Every exported function takes an `AiCredentials` as its first argument — the key,
model and reasoning effort belonging to the person who triggered the call. There
is no instance-wide key and no fallback; if you add a new AI route, load
credentials with `loadAiCredentials(user.id)` and return `MISSING_KEY_MESSAGE`
when it comes back null.

## Errors

Routes export an `ErrorBoundary` returning `<RouteErrorPanel>`; `root.tsx` has the
global fallback. Both show the raw message and stack **only in development** —
those branches are compiled out of the production bundle. Please keep it that way:
never render an exception's message or stack unconditionally.

## Commits and PRs

- Keep the diff to one thing.
- Say what breaks if the change is wrong — that is the most useful line in a PR
  description here.
- Screenshots for anything visual.

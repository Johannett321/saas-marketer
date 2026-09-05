# Architecture

How the pieces fit together, and why they are arranged this way. For the rules you
have to follow while changing them, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Shape of the app

React Router v8 in framework mode with SSR on. Routes are declared explicitly in
`app/routes.ts` — not file-based — and each route module imports its generated
types from `./+types/<route-name>`.

Data lives in Postgres behind Prisma 7 with the `@prisma/adapter-pg` driver
adapter. The client is generated into `app/generated/prisma` (gitignored), and the
datasource URL lives in `prisma.config.ts`, which loads dotenv, rather than in
`schema.prisma`.

## Access control

`app/lib/workspace.server.ts` is the only gate. Every loader and action starts with
`requireUser(request)` from `session.server`, then one of:

| Guard | Resolves |
| --- | --- |
| `requireWorkspace(userId, slug, { minRole })` | a workspace the user belongs to |
| `requireProject(userId, wsSlug, projectSlug)` | a project inside one |
| `requireProjectById(userId, projectId)` | same, from an id in a form body |
| `requireCard(userId, cardId)` | a card, with its project and workspace |

All of them `throw data(..., { status: 404 })` when the user has no membership.
**Non-members get 404, not 403**, so the existence of a workspace or card is never
leaked to someone who cannot see it.

Role rank is `MEMBER < ADMIN < OWNER`. Privileged actions pass `minRole` to
`requireWorkspace`.

Resource routes under `/api/*` receive an id in the form body, so they must resolve
it through `requireProjectById` / `requireCard` rather than trusting the id. That
is the whole authorization story for those routes.

## Mutations

One action per route, dispatched on an `intent` field. Every action reads
`form.get("intent")`, switches on it, and falls through to
`throw data("Unknown intent", { status: 400 })`. Forms carry a hidden `intent`
input; client-side callers use `fetcher.submit({ intent, ... })`.

## Activity, live updates and analytics are coupled

These three are one system, and the couplings are easy to break by accident.

```
                        ┌──────────────────────┐
  card mutation ───────▶│  recordActivity()    │
                        └──────────┬───────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
             Activity row                  emit() → SSE
        (the card's history)         (every open tab in the workspace)
```

- **`recordActivity()`** in `app/lib/activity.server.ts` is the single write path
  for anything a user should see. It appends the `Activity` row rendered in the
  card's history *and* broadcasts the same fact over SSE. Skip it and the change
  is invisible to other tabs.

- **`moveCard()`** in `app/lib/cards.server.ts` is the single write path for
  column changes. Positions are floats with a gap of 1000 and midpoint insertion,
  and the function writes the `StatusEvent` row. Analytics counts "videos
  produced" from `StatusEvent` rows reaching `READY_TO_PUBLISH` / `SCHEDULED`, so
  a direct `db.videoCard.update({ status })` silently drops the card out of the
  numbers.

- **`saveRevision()`** in `api.script.tsx` updates the card and appends a
  `ScriptRevision` in one transaction. Analytics counts "scripts written" from
  those rows.

Adding an `ActivityType` requires four edits or it breaks at runtime: the enum in
`schema.prisma`, a migration, `ACTIVITY_COPY` in `app/lib/activity.ts` (shared
phrasing for both the toast and the history line), and the `KIND` map in
`activity.server.ts`.

### The event bus

`app/lib/events.server.ts` is an **in-process** pub/sub keyed by workspace id,
exposed at `/api/stream/:workspaceSlug` as SSE with a 25 second keepalive.
`<Realtime>` in `app-layout.tsx` opens one connection per tab, revalidates on
every event (debounced 120ms so bursts coalesce into one revalidation), and only
toasts events whose `actor.id` is not the current user.

Because it is in-process, running several instances behind a load balancer needs a
shared transport — Postgres `LISTEN/NOTIFY` or Redis. Swap `emit`/`subscribe` and
nothing else changes.

## AI

Everything OpenAI lives in `app/lib/ai.server.ts`: the Responses API, the
`web_search` tool, and strict `json_schema` outputs for anything structured.

Two rules hold the design together:

1. **Prompts stay vertical-agnostic.** The only domain knowledge allowed in a
   prompt is the project's own `niche` and `description`, assembled by
   `projectBrief()`. No hardcoded industry, product or audience anywhere.
2. **Calls are slow, so they never run in a page loader.** `/api/ideas`,
   `/api/script`, `/api/title` and `/api/project-profile` are POST-only resource
   routes — their loaders 404 — invoked with `useFetcher`. `<WaitingGame>` (Spark
   Catcher, scores in `GameScore`) exists because the calls take tens of seconds
   at `high` reasoning effort.

### Credentials

There is no instance-wide API key. Every exported function in `ai.server.ts` takes
an `AiCredentials` — `{ apiKey, model, reasoningEffort }` — as its first argument,
loaded per request from the calling user's profile by
`loadAiCredentials(userId)`.

Keys are encrypted with AES-256-GCM before they are stored (`secrets.server.ts`),
using a key derived from `SESSION_SECRET`. A rotated `SESSION_SECRET` makes stored
keys unreadable, which is treated as "no key set" rather than an error, so
rotation degrades gracefully.

The rationale, and what this means when you host this for other people, is in
[self-hosting.md](self-hosting.md).

### Idea flow

Generation persists an `IdeaBatch` plus `IdeaSuggestion` rows first; accepting a
suggestion is a separate `intent: "accept"` that creates the card and stamps
`usedCardId`. Article context captured at idea time (`sourceUrl` / `sourceTitle` /
`sourceExcerpt`) rides onto the card and is reused when the script is generated.
If it is missing but a URL is present, `api.script.tsx` fetches the article once
and caches the excerpt on the card.

## Navigation shell

`app-layout` (top bar, workspace switcher, `<Realtime>`) wraps two sibling layouts
that render the same `<Sidebar>` shell with different items:

- `workspace-layout` — Projects / Analytics / Members
- `project-layout` — Kanban / Settings

Because the frame is identical, moving between levels swaps the items in place
rather than repainting the panel. Breadcrumbs are collected by `useCrumbs()` from
each matched route's `handle.breadcrumb(loaderData)` export, so a route that should
appear in the trail must export one.

The card detail route is nested inside `project-board` and rendered as a drawer
over the board via `<Outlet />`.

`app-layout` is a pathless layout: its params never change, so React Router will
not re-run its loader on navigation and it cannot load the sidebar's contents
itself. Each level layout loads its own data and the shell reads it back off the
matches, which keeps the panel in lockstep with the URL.

## Smaller things worth knowing

- **Passwords** use scrypt via `node:crypto` (`auth.server.ts`), stored as
  `scrypt:<salt>:<hash>`.
- **Avatars** are uploaded bytes on `User`, served by `/avatar/:userId` with an
  ETag derived from `avatarUpdatedAt`, readable only by workspace peers. The
  browser downscales to a 256px square WebP before upload, so the database only
  ever holds thumbnails.
- **The five columns** are defined once in `app/lib/stages.ts` (`STAGES` /
  `STAGE_BY_ID`), including labels and colour tokens. The `CardStatus` enum must
  stay in sync.
- **Scripts** are stored as markdown. The editor is tiptap with `tiptap-markdown`
  doing the round-trip (`script-editor.tsx`, `immediatelyRender: false` because
  the drawer server-renders first).
- **Errors**: routes export `ErrorBoundary` returning `<RouteErrorPanel>`;
  `root.tsx` has the global fallback. Raw messages and stacks render only in
  development — those branches are eliminated from the production bundle.

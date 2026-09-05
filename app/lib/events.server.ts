/**
 * In-process pub/sub for live board updates.
 *
 * Events are broadcast to every SSE connection subscribed to the workspace.
 * Clients always revalidate; they suppress the toast for their own actions.
 *
 * NOTE: this is per-process. Running several app instances behind a load
 * balancer would need a shared bus (Postgres LISTEN/NOTIFY or Redis) — swap
 * `emit`/`subscribe` and nothing else changes.
 */

export type BoardEventKind =
  | "card.created"
  | "card.moved"
  | "card.updated"
  | "card.assigned"
  | "card.script"
  | "card.comment"
  | "card.video"
  | "card.deleted";

export type BoardEvent = {
  id: string;
  kind: BoardEventKind;
  workspaceId: string;
  workspaceSlug: string;
  projectSlug: string;
  cardId: string;
  cardTitle: string;
  actor: { id: string; name: string; avatarHue: number; avatarUpdatedAt?: Date | string | null };
  /** Rendered as: **actor** action **cardTitle** [suffix **target**] */
  action: string;
  suffix?: string;
  target?: string;
  createdAt: string;
};

type Listener = (event: BoardEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __boardListeners__: Map<string, Set<Listener>> | undefined;
}

const listeners = (global.__boardListeners__ ??= new Map<string, Set<Listener>>());

export function subscribe(workspaceId: string, listener: Listener) {
  let set = listeners.get(workspaceId);
  if (!set) {
    set = new Set();
    listeners.set(workspaceId, set);
  }
  set.add(listener);

  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(workspaceId);
  };
}

export function emit(event: BoardEvent) {
  const set = listeners.get(event.workspaceId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // a broken connection must not take down the others
    }
  }
}

/** Convenience wrapper so route actions only pass what changed. */
export function emitCard(input: {
  kind: BoardEventKind;
  workspace: { id: string; slug: string };
  projectSlug: string;
  card: { id: string; title: string };
  actor: { id: string; name: string; avatarHue: number; avatarUpdatedAt?: Date | string | null };
  action: string;
  suffix?: string;
  target?: string;
}) {
  emit({
    id: crypto.randomUUID(),
    kind: input.kind,
    workspaceId: input.workspace.id,
    workspaceSlug: input.workspace.slug,
    projectSlug: input.projectSlug,
    cardId: input.card.id,
    cardTitle: input.card.title,
    actor: input.actor,
    action: input.action,
    suffix: input.suffix,
    target: input.target,
    createdAt: new Date().toISOString(),
  });
}

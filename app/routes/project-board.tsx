import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, data, useFetcher, useParams } from "react-router";
import { DndProvider, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Link2, Newspaper, PenLine, Plus, Shuffle, Sparkles, X } from "lucide-react";
import type { Route } from "./+types/project-board";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireProject } from "~/lib/workspace.server";
import { moveCard, nextPosition } from "~/lib/cards.server";
import { recordActivity } from "~/lib/activity.server";
import { STAGES, STAGE_BY_ID } from "~/lib/stages";
import type { CardStatus } from "~/generated/prisma/enums";
import { Avatar } from "~/components/ui";
import {
  BoardCardTile,
  CARD_DND_TYPE,
  type BoardCard,
  type DragItem,
} from "~/components/board-card";
import { IdeaGenerator } from "~/components/idea-generator";
import { AiKeyNotice, useHasAiKey } from "~/components/ai-key-notice";
import { RouteErrorPanel } from "~/components/route-error";

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `${loaderData?.project.name ?? "Board"} · saas-marketer` },
];

export const handle = {
  breadcrumb: (data: { workspace: { slug: string }; project: { name: string; slug: string } } | undefined) =>
    data ? { label: data.project.name, to: `/app/${data.workspace.slug}/p/${data.project.slug}` } : null,
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { workspace, project } = await requireProject(
    user.id,
    params.workspaceSlug!,
    params.projectSlug!,
  );

  const cards = await db.videoCard.findMany({
    where: { projectId: project.id },
    orderBy: [{ status: "asc" }, { position: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      angle: true,
      source: true,
      sourceUrl: true,
      script: true,
      assignee: { select: { id: true, name: true, avatarHue: true, avatarUpdatedAt: true } },
      _count: { select: { comments: true } },
    },
  });

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    select: { user: { select: { id: true, name: true, avatarHue: true, avatarUpdatedAt: true } } },
    orderBy: { createdAt: "asc" },
  });

  return {
    workspace: { name: workspace.name, slug: workspace.slug },
    project: { id: project.id, name: project.name, slug: project.slug, niche: project.niche },
    members: members.map((m) => m.user),
    cards: cards.map(
      (c): BoardCard => ({
        id: c.id,
        title: c.title,
        status: c.status,
        angle: c.angle,
        source: c.source,
        sourceUrl: c.sourceUrl,
        hasScript: Boolean(c.script && c.script.trim()),
        commentCount: c._count.comments,
        assignee: c.assignee,
      }),
    ),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { workspace, project } = await requireProject(
    user.id,
    params.workspaceSlug!,
    params.projectSlug!,
  );
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "move") {
    const cardId = String(form.get("cardId"));
    const status = String(form.get("status")) as CardStatus;
    const beforeRaw = form.get("beforeCardId");
    const beforeCardId = beforeRaw && beforeRaw !== "" ? String(beforeRaw) : null;

    const owned = await db.videoCard.findFirst({
      where: { id: cardId, projectId: project.id },
      select: { id: true, title: true, status: true },
    });
    if (!owned) throw data("Card not found", { status: 404 });

    await moveCard({ cardId, status, beforeCardId, userId: user.id });

    if (owned.status !== status) {
      await recordActivity({
        type: "MOVED",
        card: owned,
        workspace,
        projectSlug: project.slug,
        actor: user,
        detail: STAGE_BY_ID[status].label,
        fromValue: STAGE_BY_ID[owned.status].label,
      });
    }
    return { ok: true };
  }

  if (intent === "create") {
    const title = String(form.get("title") ?? "").trim();
    const status = (String(form.get("status") ?? "IDEA") || "IDEA") as CardStatus;
    if (!title) return data({ error: "Write a title" }, { status: 400 });

    const card = await db.videoCard.create({
      data: {
        projectId: project.id,
        title,
        status,
        position: await nextPosition(project.id, status),
        createdById: user.id,
        source: "MANUAL",
      },
    });
    await db.statusEvent.create({ data: { cardId: card.id, toStatus: status, userId: user.id } });

    await recordActivity({
      type: "CREATED",
      card,
      workspace,
      projectSlug: project.slug,
      actor: user,
    });
    return { ok: true, cardId: card.id };
  }

  throw data("Unknown intent", { status: 400 });
}

export default function ProjectBoard({ loaderData }: Route.ComponentProps) {
  const { workspace, project, cards, members } = loaderData;
  const params = useParams();
  const fetcher = useFetcher();
  // `null` means closed; a mode means open and preset to that source.
  const [generator, setGenerator] = useState<GeneratorMode | null>(null);
  // Which column has its composer open. The board owns this so the header's
  // "New idea" can open the Idea column's composer from outside the column.
  const [composing, setComposing] = useState<CardStatus | null>(null);

  // optimistic move so the card lands in the new column immediately
  const pending = fetcher.formData?.get("intent") === "move"
    ? {
        cardId: String(fetcher.formData.get("cardId")),
        status: String(fetcher.formData.get("status")) as CardStatus,
        beforeCardId: (fetcher.formData.get("beforeCardId") as string) || null,
      }
    : null;

  const columns = useMemo(() => {
    let list = cards;
    if (pending) {
      const moving = cards.find((c) => c.id === pending.cardId);
      if (moving) {
        const rest = cards.filter((c) => c.id !== pending.cardId);
        const updated = { ...moving, status: pending.status };
        const idx = pending.beforeCardId
          ? rest.findIndex((c) => c.id === pending.beforeCardId)
          : -1;
        list = idx === -1 ? [...rest, updated] : [...rest.slice(0, idx), updated, ...rest.slice(idx)];
      }
    }
    return STAGES.map((stage) => ({
      stage,
      cards: list.filter((c) => c.status === stage.id),
    }));
  }, [cards, pending]);

  const move = useCallback(
    (item: DragItem, status: CardStatus, beforeCardId: string | null) => {
      fetcher.submit(
        { intent: "move", cardId: item.id, status, beforeCardId: beforeCardId ?? "" },
        { method: "post" },
      );
    },
    [fetcher],
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-base-100/70 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold text-ink-900">{project.name}</h1>
            <p className="text-[12px] text-ink-500">
              {cards.length} card{cards.length === 1 ? "" : "s"}
              {project.niche ? ` · ${project.niche}` : ""}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden -space-x-2 sm:flex">
              {members.slice(0, 5).map((m) => (
                <Avatar key={m.id} user={m} size={26} className="ring-2 ring-base-100" />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm gap-1.5"
              onClick={() => setComposing("IDEA")}
            >
              <Plus className="size-4" /> New idea
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-1.5"
              onClick={() => setGenerator("RANDOM")}
            >
              <Sparkles className="size-4" /> Generate ideas
            </button>
          </div>
        </header>

        {cards.length === 0 && composing === null ? (
          <EmptyBoard
            niche={project.niche}
            onGenerate={setGenerator}
            onWriteOwn={() => setComposing("IDEA")}
          />
        ) : (
        <div className="min-h-0 flex-1 overflow-x-auto">
          <div className="flex h-full min-w-max gap-4 p-5">
            {columns.map(({ stage, cards: columnCards }) => (
              <Column
                key={stage.id}
                stage={stage}
                cards={columnCards}
                workspaceSlug={workspace.slug}
                projectSlug={project.slug}
                selectedCardId={params.cardId}
                onMove={move}
                isComposing={composing === stage.id}
                onComposingChange={(open) => setComposing(open ? stage.id : null)}
              />
            ))}
          </div>
        </div>
        )}
      </div>

      <Outlet />

      {generator && (
        <IdeaGenerator
          projectId={project.id}
          workspaceSlug={workspace.slug}
          niche={project.niche}
          initialMode={generator}
          onClose={() => setGenerator(null)}
        />
      )}
    </DndProvider>
  );
}

type GeneratorMode = "RANDOM" | "NEWS" | "URL";

const SOURCES: Array<{
  id: GeneratorMode;
  label: string;
  body: (niche: string | null) => string;
  icon: typeof Shuffle;
}> = [
  {
    id: "NEWS",
    label: "Today's news",
    body: (niche) =>
      niche
        ? `Five angles off what happened today in ${niche}.`
        : "Five angles off what happened in your field today.",
    icon: Newspaper,
  },
  {
    id: "URL",
    label: "From a page",
    body: () => "Paste an article. The AI reads it and pitches five takes.",
    icon: Link2,
  },
  {
    id: "RANDOM",
    label: "From scratch",
    body: () => "No source, no link — just five titles to react to.",
    icon: Shuffle,
  },
];

/**
 * What a brand new board shows instead of five identical dashed hints.
 *
 * An empty board is the moment the app is least convincing, so this offers the
 * three ways to fill it as one click each — and, when the key is missing, the
 * field to add it, rather than sending someone to the profile page and hoping
 * they find their way back.
 */
function EmptyBoard({
  niche,
  onGenerate,
  onWriteOwn,
}: {
  niche: string | null;
  onGenerate: (mode: GeneratorMode) => void;
  onWriteOwn: () => void;
}) {
  const hasAiKey = useHasAiKey();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-10">
      <div className="mx-auto w-full max-w-2xl animate-fade-up">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Sparkles className="size-6" />
          </span>
          <h2 className="mt-4 text-xl font-semibold text-ink-900">
            Your board is empty. Fill it in one click.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Pick where the first ideas come from. Each one arrives as a card with its angle and
            its source attached, ready for a script.
          </p>
        </div>

        {!hasAiKey && (
          <div className="mt-6">
            <AiKeyNotice action="Idea generation" />
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {SOURCES.map(({ id, label, body, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onGenerate(id)}
              className="group rounded-box border border-ink-200 bg-base-100 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/60"
            >
              <span className="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                <Icon className="size-4" />
              </span>
              <p className="mt-3 text-[13.5px] font-medium text-ink-900">{label}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{body(niche)}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onWriteOwn}
            className="btn btn-ghost btn-sm gap-1.5 text-ink-500 hover:text-brand-600"
          >
            <PenLine className="size-3.5" /> Or write the first title yourself
          </button>
        </div>

        <div className="mt-10 rounded-box border border-ink-200 bg-base-200/50 p-4">
          <p className="text-[12px] font-semibold tracking-wider text-ink-400 uppercase">
            Where cards go from here
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {STAGES.map((stage) => (
              <div key={stage.id}>
                <div className="flex items-center gap-1.5">
                  <span className={`size-1.5 shrink-0 rounded-full ${stage.dot}`} />
                  <span className="truncate text-[11px] font-medium text-ink-600">
                    {stage.short}
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-ink-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Column({
  stage,
  cards,
  workspaceSlug,
  projectSlug,
  selectedCardId,
  onMove,
  isComposing,
  onComposingChange,
}: {
  stage: (typeof STAGES)[number];
  cards: BoardCard[];
  workspaceSlug: string;
  projectSlug: string;
  selectedCardId?: string;
  onMove: (item: DragItem, status: CardStatus, beforeCardId: string | null) => void;
  isComposing: boolean;
  onComposingChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher();
  const sectionRef = useRef<HTMLElement | null>(null);

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: CARD_DND_TYPE,
      drop: (item: DragItem, monitor) => {
        if (monitor.didDrop()) return; // a card inside the column handled it
        onMove(item, stage.id, null);
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [stage.id, onMove],
  );

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) onComposingChange(false);
  }, [fetcher.state, fetcher.data, onComposingChange]);

  // Opening from the board header may mean this column is scrolled out of view.
  // `nearest` leaves an already-visible column alone, so the column's own +
  // button never causes a jump.
  useEffect(() => {
    if (!isComposing) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [isComposing]);

  return (
    <section
      ref={(node) => {
        sectionRef.current = node;
        (drop as unknown as (el: HTMLElement | null) => void)(node);
      }}
      className={`flex w-[19rem] shrink-0 flex-col rounded-box border transition-colors ${
        isOver ? "border-brand-300 bg-brand-50/50" : "border-ink-200 bg-base-200/50"
      }`}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={`size-2 rounded-full ${stage.dot}`} />
        <h2 className="text-[13px] font-semibold text-ink-800">{stage.label}</h2>
        <span className="rounded-full bg-ink-200 px-1.5 text-[11px] text-ink-600">
          {cards.length}
        </span>
        <button
          className="ml-auto grid size-6 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-200 hover:text-ink-700"
          onClick={() => onComposingChange(!isComposing)}
          title="New card"
          type="button"
        >
          {isComposing ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 pb-3">
        {isComposing && (
          <fetcher.Form method="post" className="rounded-selector border border-brand-300 bg-base-100 p-2">
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="status" value={stage.id} />
            <textarea
              name="title"
              rows={2}
              autoFocus
              placeholder="Video title…"
              className="textarea textarea-ghost w-full resize-none border-0 bg-transparent p-1 text-[13.5px] leading-snug focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
                if (e.key === "Escape") onComposingChange(false);
              }}
              required
            />
            <div className="mt-1 flex justify-end gap-1.5">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onComposingChange(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary btn-xs">Add</button>
            </div>
          </fetcher.Form>
        )}

        {cards.map((card) => (
          <BoardCardTile
            key={card.id}
            card={card}
            to={`/app/${workspaceSlug}/p/${projectSlug}/card/${card.id}`}
            isSelected={card.id === selectedCardId}
            onDropBefore={(item, beforeCardId) => onMove(item, stage.id, beforeCardId)}
          />
        ))}

        {cards.length === 0 && !isComposing && (
          <button
            type="button"
            onClick={() => onComposingChange(true)}
            className="w-full rounded-selector border border-dashed border-ink-300 px-3 py-6 text-[12.5px] text-ink-400 transition-colors hover:border-brand-300 hover:text-brand-600"
          >
            {stage.hint}
          </button>
        )}
      </div>
    </section>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel />;
}

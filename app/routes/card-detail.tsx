import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useNavigate, useParams, useRevalidator, useSubmit } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  Maximize2,
  Globe,
  Pencil,
  Send,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import type { Route } from "./+types/card-detail";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireCard } from "~/lib/workspace.server";
import { moveCard } from "~/lib/cards.server";
import { recordActivity } from "~/lib/activity.server";
import { STAGE_BY_ID, SOURCE_LABEL } from "~/lib/stages";
import { historyText } from "~/lib/activity";
import type { CardStatus } from "~/generated/prisma/enums";
import { Avatar } from "~/components/ui";
import { useConfirm } from "~/components/confirm";
import { WaitingGame } from "~/components/waiting-game";
import { ScriptEditor } from "~/components/script-editor";
import { RouteErrorPanel, WidgetBoundary } from "~/components/route-error";
import { Teleprompter } from "~/components/teleprompter";
import { AssigneePicker, StatusPicker } from "~/components/pickers";
import type { TitleOption } from "~/lib/ai.server";

export const handle = {
  breadcrumb: (data: { card: { title: string } } | undefined) =>
    data ? { label: data.card.title } : null,
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { card } = await requireCard(user.id, params.cardId!);

  const [comments, members, revisions, activities] = await Promise.all([
    db.comment.findMany({
      where: { cardId: card.id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true, avatarHue: true, avatarUpdatedAt: true } } },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: card.project.workspaceId },
      select: { user: { select: { id: true, name: true, avatarHue: true, avatarUpdatedAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.scriptRevision.findMany({
      where: { cardId: card.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { createdBy: { select: { name: true } } },
    }),
    db.activity.findMany({
      where: { cardId: card.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { id: true, name: true, avatarHue: true, avatarUpdatedAt: true } } },
    }),
  ]);

  return {
    me: user,
    card: {
      id: card.id,
      title: card.title,
      status: card.status,
      angle: card.angle,
      description: card.description,
      script: card.script,
      scriptUpdatedAt: card.scriptUpdatedAt?.toISOString() ?? null,
      source: card.source,
      sourceUrl: card.sourceUrl,
      sourceTitle: card.sourceTitle,
      assigneeId: card.assigneeId,
      createdAt: card.createdAt.toISOString(),
    },
    members: members.map((m) => m.user),
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
    revisions: revisions.map((r) => ({
      id: r.id,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
      author: r.createdBy.name,
    })),
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      detail: a.detail,
      fromValue: a.fromValue,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
    })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { card } = await requireCard(user.id, params.cardId!);
  const form = await request.formData();
  const intent = String(form.get("intent"));

  const workspace = card.project.workspace;
  const log = (
    type: Parameters<typeof recordActivity>[0]["type"],
    extra?: { title?: string; detail?: string | null; fromValue?: string | null },
  ) =>
    recordActivity({
      type,
      card: { id: card.id, title: extra?.title ?? card.title },
      workspace,
      projectSlug: card.project.slug,
      actor: user,
      detail: extra?.detail,
      fromValue: extra?.fromValue,
    });

  switch (intent) {
    case "update-title": {
      const title = String(form.get("title") ?? "").trim();
      if (title && title !== card.title) {
        await db.videoCard.update({ where: { id: card.id }, data: { title } });
        await log("TITLE_CHANGED", { title, detail: title, fromValue: card.title });
      }
      return { ok: true };
    }
    case "assign": {
      const raw = String(form.get("assigneeId") ?? "");
      const assigneeId = raw === "" ? null : raw;
      let assigneeName: string | null = null;

      if (assigneeId) {
        const member = await db.workspaceMember.findUnique({
          where: {
            workspaceId_userId: { workspaceId: card.project.workspaceId, userId: assigneeId },
          },
          include: { user: { select: { name: true } } },
        });
        if (!member) return { ok: false };
        assigneeName = member.user.name;
      }

      await db.videoCard.update({ where: { id: card.id }, data: { assigneeId } });
      await log(assigneeId ? "ASSIGNED" : "UNASSIGNED", { detail: assigneeName });
      return { ok: true };
    }
    case "status": {
      const status = String(form.get("status")) as CardStatus;
      if (status !== card.status) {
        await moveCard({ cardId: card.id, status, beforeCardId: null, userId: user.id });
        await log("MOVED", {
          detail: STAGE_BY_ID[status].label,
          fromValue: STAGE_BY_ID[card.status].label,
        });
      }
      return { ok: true };
    }
    case "comment": {
      const body = String(form.get("body") ?? "").trim();
      if (body) {
        await db.comment.create({ data: { cardId: card.id, authorId: user.id, body } });
        await log("COMMENTED");
      }
      return { ok: true };
    }
    case "delete": {
      await db.videoCard.delete({ where: { id: card.id } });
      return { deleted: true };
    }
  }

  return { ok: false };
}

type ScriptResponse = { ok?: true; script?: string; error?: string };

export default function CardDetail({ loaderData, params }: Route.ComponentProps) {
  const { card, members, comments, revisions, activities, me } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const submit = useSubmit();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const script = useFetcher<ScriptResponse>();
  const meta = useFetcher<{ deleted?: boolean }>();
  const titles = useFetcher<{ options?: TitleOption[]; error?: string }>();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState(card.script ?? "");
  const [improveOpen, setImproveOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const commentRef = useRef<HTMLFormElement>(null);

  const back = `/app/${params.workspaceSlug}/p/${params.projectSlug}`;

  useEffect(() => {
    if (script.state === "idle" && script.data?.script !== undefined) {
      setDraft(script.data.script ?? "");
      setImproveOpen(false);
      revalidator.revalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.state, script.data]);

  useEffect(() => {
    setDraft(card.script ?? "");
  }, [card.id, card.script]);

  useEffect(() => {
    if (meta.data?.deleted) navigate(back, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || reading || regenOpen) return;
      const el = e.target;
      if (el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      navigate(back);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, navigate, reading, regenOpen]);

  const busy = script.state !== "idle";
  const titlesLoading = titles.state !== "idle";
  const scriptError = script.data?.error;
  const hasScript = Boolean(draft.trim());
  const lastRevision = revisions[0];

  const runScript = (intent: "generate" | "improve" | "save", extra: Record<string, string> = {}) =>
    script.submit({ intent, cardId: card.id, ...extra }, { method: "post", action: "/api/script" });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        className="absolute inset-0 bg-ink-950/25 backdrop-blur-[2px]"
        onClick={() => navigate(back)}
        aria-label="Close"
      />

      <aside className="relative flex h-full w-full max-w-2xl flex-col border-l border-ink-200 bg-base-100 shadow-2xl animate-fade-in">
        {/* ---------------------------------------------------------- header */}
        <header className="shrink-0 border-b border-ink-200 px-6 pt-5 pb-4">
          {/* the status picker below already says where the card sits */}
          <div className="flex min-h-8 items-center gap-2">
            {card.source !== "MANUAL" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-medium text-brand-700">
                <Sparkles className="size-2.5" /> {SOURCE_LABEL[card.source]}
              </span>
            )}
            <Link
              to={back}
              className="ml-auto grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="size-4" />
            </Link>
          </div>

          {editingTitle ? (
            <meta.Form method="post" onSubmit={() => setEditingTitle(false)} className="mt-3">
              <input type="hidden" name="intent" value="update-title" />
              <input
                name="title"
                defaultValue={card.title}
                autoFocus
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                className="input w-full bg-base-100 text-xl font-semibold"
              />
            </meta.Form>
          ) : (
            <h1 className="group mt-3 text-xl leading-snug font-semibold tracking-tight text-ink-900">
              <span
                onClick={() => !titlesLoading && setEditingTitle(true)}
                className={`cursor-text ${titlesLoading ? "shimmer-text" : ""}`}
              >
                {card.title}
              </span>

              {/* sits on the title line so it reads as an action on the title itself */}
              <button
                type="button"
                title="Rewrite this title with AI"
                aria-label="Rewrite this title with AI"
                disabled={titlesLoading}
                onClick={() => {
                  setTitlesOpen(true);
                  titles.submit({ cardId: card.id }, { method: "post", action: "/api/title" });
                }}
                className={`ml-2 inline-grid size-7 -translate-y-0.5 place-items-center rounded-lg align-middle text-brand-600 transition-all ${
                  titlesLoading
                    ? "bg-brand-50 opacity-100"
                    : "opacity-60 hover:bg-brand-50 hover:opacity-100 group-hover:opacity-100"
                }`}
              >
                <Sparkles className={`size-4 ${titlesLoading ? "animate-pulse" : ""}`} />
              </button>

              <Pencil
                onClick={() => !titlesLoading && setEditingTitle(true)}
                className="inline-block size-3.5 -translate-y-0.5 cursor-pointer text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </h1>
          )}

          {titlesOpen && (titlesLoading || titles.data?.options || titles.data?.error) && (
            <TitleSuggestions
              loading={titlesLoading}
              options={titles.data?.options}
              error={titles.data?.error}
              onDismiss={() => setTitlesOpen(false)}
              onPick={(title) => {
                meta.submit({ intent: "update-title", title }, { method: "post" });
                setTitlesOpen(false);
              }}
            />
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPicker
              value={card.status}
              onChange={(status) => meta.submit({ intent: "status", status }, { method: "post" })}
            />

            <AssigneePicker
              value={card.assigneeId}
              members={members}
              currentUserId={me.id}
              onChange={(assigneeId) =>
                meta.submit({ intent: "assign", assigneeId }, { method: "post" })
              }
            />

            {card.sourceUrl && (
              <a
                href={card.sourceUrl}
                target="_blank"
                rel="noreferrer"
                title={card.sourceTitle ?? card.sourceUrl}
                className="ml-auto inline-flex max-w-[13rem] items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] text-ink-400 transition-colors hover:bg-ink-100 hover:text-brand-700"
              >
                <Globe className="size-3.5 shrink-0" />
                <span className="truncate">{card.sourceTitle ?? "Source"}</span>
              </a>
            )}
          </div>
        </header>

        {/* ---------------------------------------------------------- body */}
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
          <section>
            {hasScript && !busy && mode === "preview" && (
              <div className="mb-2 flex justify-end">
                <AiMenu
                  onImprove={() => setImproveOpen(true)}
                  onRegenerate={() => setRegenOpen(true)}
                />
              </div>
            )}

            {scriptError && (
              <div className="mb-3 rounded-box border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
                {scriptError}
              </div>
            )}

            {improveOpen && !busy && (
              <div className="mb-3 rounded-box border border-brand-200 bg-brand-50/50 p-3">
                <p className="text-[12.5px] text-ink-600">
                  What should change? Leave empty for a general tightening.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    id="improve-instruction"
                    autoFocus
                    placeholder="e.g. stronger hook, shorter, more concrete numbers…"
                    className="input input-sm flex-1 bg-base-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        runScript("improve", { instruction: e.currentTarget.value });
                    }}
                  />
                  <button
                    className="btn btn-primary btn-sm gap-1.5"
                    onClick={() => {
                      const el = document.getElementById(
                        "improve-instruction",
                      ) as HTMLInputElement | null;
                      runScript("improve", { instruction: el?.value ?? "" });
                    }}
                  >
                    <Wand2 className="size-3.5" /> Run
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setImproveOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* rewriting an existing script: keep it on screen under a sweeping light */}
            {busy && hasScript && (
              <article className="script-generating prose-script rounded-box px-4 py-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
              </article>
            )}

            {busy && (
              <WidgetBoundary label="The waiting game">
                <WaitingGame
                  workspaceSlug={params.workspaceSlug!}
                  status={
                    hasScript
                      ? "Rewriting the script…"
                      : card.sourceUrl
                        ? "Reading the source and writing the script…"
                        : "Searching the web, reading sources and writing the script…"
                  }
                />
              </WidgetBoundary>
            )}

            {!busy && !hasScript && (
              <div className="rounded-box border border-dashed border-ink-300 px-6 py-12 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <Sparkles className="size-5" />
                </div>
                <p className="mt-3 font-medium text-ink-800">No script yet</p>
                <p className="mx-auto mt-1 max-w-xs text-[13px] text-ink-500">
                  {card.sourceUrl
                    ? "The AI uses the original article as context when writing the script."
                    : "The AI searches the web, reads the best sources and writes the script from the title."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    className="btn btn-primary btn-sm gap-1.5"
                    onClick={() => runScript("generate")}
                  >
                    <Sparkles className="size-4" /> Generate script with AI
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (!draft.trim()) setDraft("## Hook\n\n\n## Body\n\n\n## CTA\n");
                      setMode("edit");
                    }}
                  >
                    Write it yourself
                  </button>
                </div>
              </div>
            )}

            {!busy && hasScript && mode === "preview" && (
              <>
                <div className="group/script relative">
                  <button
                    type="button"
                    onClick={() => setReading(true)}
                    title="Open full screen for filming"
                    aria-label="Open full screen for filming"
                    className="absolute top-1 right-1 z-10 grid size-8 place-items-center rounded-lg text-ink-300 opacity-70 transition-all hover:bg-ink-100 hover:text-ink-700 hover:opacity-100 group-hover/script:opacity-100"
                  >
                    <Maximize2 className="size-4" />
                  </button>

                  <article
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a")) return;
                      setMode("edit");
                    }}
                    title="Click to edit"
                    className="prose-script cursor-text rounded-box px-4 py-3 transition-colors hover:bg-ink-100/50"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
                  </article>
                </div>
                {lastRevision && (
                  <p className="mt-2.5 text-[12px] text-ink-400">
                    Last changed{" "}
                    {formatDistanceToNow(new Date(lastRevision.createdAt), { addSuffix: true })} ·{" "}
                    {lastRevision.source === "AI_GENERATED"
                      ? "AI generated"
                      : lastRevision.source === "AI_IMPROVED"
                        ? "AI improved"
                        : `edited by ${lastRevision.author}`}
                  </p>
                )}
              </>
            )}

            {!busy && hasScript && mode === "edit" && (
              <div>
                <WidgetBoundary label="The editor">
                  <ScriptEditor value={draft} onChange={setDraft} />
                </WidgetBoundary>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setDraft(card.script ?? "");
                      setMode("preview");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      runScript("save", { script: draft });
                      setMode("preview");
                    }}
                  >
                    Save script
                  </button>
                </div>
              </div>
            )}
          </section>

          <CommentsSection comments={comments} me={me} meta={meta} formRef={commentRef} />

          <ActivitySection
            activities={activities}
            open={historyOpen}
            onToggle={() => setHistoryOpen((v) => !v)}
          />
        </div>

        {/* ---------------------------------------------------------- footer */}
        <footer className="flex shrink-0 items-center justify-between border-t border-ink-200 px-6 py-3">
          <p className="text-[12px] text-ink-400">
            Created {formatDistanceToNow(new Date(card.createdAt), { addSuffix: true })}
          </p>
          <meta.Form
            method="post"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const ok = await confirm({
                title: "Delete this card?",
                description: (
                  <>
                    <span className="font-medium text-ink-800">{card.title}</span> and its script,
                    comments and history will be removed. This cannot be undone.
                  </>
                ),
                confirmLabel: "Delete card",
                danger: true,
              });
              if (ok) submit(form);
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <button className="btn btn-ghost btn-xs gap-1.5 text-ink-400 hover:text-error">
              <Trash2 className="size-3.5" /> Delete
            </button>
          </meta.Form>
        </footer>
      </aside>

      {reading && hasScript && (
        <Teleprompter title={card.title} script={draft} onClose={() => setReading(false)} />
      )}

      {regenOpen && (
        <RegenerateDialog
          card={card}
          onClose={() => setRegenOpen(false)}
          onConfirm={(context) => {
            setRegenOpen(false);
            setImproveOpen(false);
            runScript("generate", context);
          }}
        />
      )}

      {confirmDialog}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

/**
 * Regenerating throws the current script away, so the context the AI will use is
 * put in front of the user first — and made editable — before anything runs.
 */
function RegenerateDialog({
  card,
  onClose,
  onConfirm,
}: {
  card: Awaited<ReturnType<typeof loader>>["card"];
  onClose: () => void;
  onConfirm: (context: { description: string; angle: string }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [description, setDescription] = useState(card.description ?? "");
  const [angle, setAngle] = useState(card.angle ?? "");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-box max-w-lg border border-ink-200 bg-base-100">
        <h3 className="text-lg font-semibold text-ink-900">Write a new script</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">
          This replaces the current script. The version you have now stays in the card&rsquo;s
          history. Check the context the AI will work from first.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label
              className="mb-1.5 block text-[12px] font-medium tracking-wider text-ink-400 uppercase"
              htmlFor="regen-description"
            >
              Description
            </label>
            <textarea
              id="regen-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this video about?"
              className="textarea w-full border-ink-200 bg-base-100 text-[13.5px] leading-relaxed"
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-[12px] font-medium tracking-wider text-ink-400 uppercase"
              htmlFor="regen-angle"
            >
              Angle
            </label>
            <textarea
              id="regen-angle"
              rows={2}
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="The one objection this video attacks."
              className="textarea w-full border-ink-200 bg-base-100 text-[13.5px] leading-relaxed"
            />
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button
            className="btn btn-primary gap-1.5"
            onClick={() => onConfirm({ description, angle })}
          >
            <RefreshCw className="size-4" /> Regenerate
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}

/**
 * State-driven menu rather than daisyUI's focus-based dropdown: the focus
 * version closes unpredictably when something inside it steals focus.
 */
function AiMenu({
  onImprove,
  onRegenerate,
}: {
  onImprove: () => void;
  onRegenerate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-xs btn-outline gap-1"
      >
        <Sparkles className="size-3" /> AI
        <ChevronDown className={`size-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-1 w-60 overflow-hidden rounded-box border border-ink-200 bg-base-100 p-1 shadow-xl animate-fade-in"
        >
          <AiAction
            icon={<Wand2 className="size-3.5" />}
            label="Improve this script"
            hint="Keeps the message, sharpens the writing"
            onSelect={() => pick(onImprove)}
          />
          <AiAction
            icon={<RefreshCw className="size-3.5" />}
            label="Write a new one"
            hint="Replaces the current script"
            onSelect={() => pick(onRegenerate)}
          />
        </div>
      )}
    </div>
  );
}

function AiAction({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="block w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brand-50"
    >
      <span className="flex items-center gap-2 text-[13px] font-medium text-ink-800">
        <span className="text-brand-600">{icon}</span>
        {label}
      </span>
      <span className="mt-0.5 block pl-[22px] text-[11.5px] leading-snug text-ink-500">{hint}</span>
    </button>
  );
}

function TitleSuggestions({
  loading,
  options,
  error,
  onPick,
  onDismiss,
}: {
  loading: boolean;
  options?: TitleOption[];
  error?: string;
  onPick: (title: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-3 rounded-box border border-brand-200 bg-brand-50/50 p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[12.5px] font-medium text-brand-700">
          {loading ? "Writing stronger titles…" : "Pick a title"}
        </p>
        <button
          onClick={onDismiss}
          className="grid size-5 place-items-center rounded text-ink-400 hover:bg-ink-200 hover:text-ink-700"
          aria-label="Dismiss suggestions"
        >
          <X className="size-3" />
        </button>
      </div>

      {error && <p className="mt-1.5 text-[13px] text-error">{error}</p>}

      {loading && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-ink-100" />
          ))}
        </div>
      )}

      {!loading && options && (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {options.map((option) => (
            <li key={option.title}>
              <button
                onClick={() => onPick(option.title)}
                className="h-full w-full rounded-lg border border-ink-200 bg-base-100 px-3 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span className="block text-[13px] font-medium text-ink-900">{option.title}</span>
                {option.note && (
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-500">
                    {option.note}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentsSection({
  comments,
  me,
  meta,
  formRef,
}: {
  comments: Awaited<ReturnType<typeof loader>>["comments"];
  me: Awaited<ReturnType<typeof loader>>["me"];
  meta: ReturnType<typeof useFetcher<{ deleted?: boolean }>>;
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  return (
    <section>
      <h2 className="text-[12px] font-semibold tracking-wider text-ink-400 uppercase">
        Comments {comments.length > 0 && <span className="text-ink-300">· {comments.length}</span>}
      </h2>

      <div className="mt-3 space-y-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar user={c.author} size={28} />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-ink-800">{c.author.name}</span>
                <span className="text-[11.5px] text-ink-400">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </span>
              </p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-700">
                {c.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <meta.Form
        method="post"
        ref={formRef}
        className="mt-3 flex gap-2"
        onSubmit={() => setTimeout(() => formRef.current?.reset(), 0)}
      >
        <input type="hidden" name="intent" value="comment" />
        <Avatar user={me} size={28} />
        <input
          name="body"
          placeholder="Write a comment…"
          className="input input-sm flex-1 bg-base-100"
          required
        />
        <button className="btn btn-sm btn-primary btn-square" aria-label="Send">
          <Send className="size-3.5" />
        </button>
      </meta.Form>
    </section>
  );
}

function ActivitySection({
  activities,
  open,
  onToggle,
}: {
  activities: Awaited<ReturnType<typeof loader>>["activities"];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-[12px] font-semibold tracking-wider text-ink-400 uppercase transition-colors hover:text-ink-600"
      >
        Activity
        <span className="rounded-full bg-ink-100 px-1.5 text-[11px] font-medium tracking-normal text-ink-500 normal-case">
          {activities.length}
        </span>
        <ChevronDown
          className={`ml-auto size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        (activities.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-400">Nothing has happened yet.</p>
        ) : (
          <ol className="mt-3 space-y-0 animate-fade-in">
            {activities.map((entry, i) => (
              <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < activities.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-7 left-[13px] h-[calc(100%-1.25rem)] w-px bg-ink-200"
                  />
                )}
                <Avatar
                  user={entry.user}
                  size={26}
                  className="relative z-10 ring-2 ring-base-100"
                />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13px] leading-relaxed text-ink-600">
                    <span className="font-medium text-ink-900">{entry.user.name}</span>{" "}
                    {historyText(entry)}
                    {entry.type === "MOVED" && entry.fromValue && (
                      <span className="text-ink-400"> (from {entry.fromValue})</span>
                    )}
                  </p>
                  <p className="text-[11.5px] text-ink-400">
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}


/** Rendered in place of the drawer, so a broken card never takes the board with it. */
export function ErrorBoundary() {
  const params = useParams();
  const back = `/app/${params.workspaceSlug}/p/${params.projectSlug}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Link to={back} className="absolute inset-0 bg-ink-950/25 backdrop-blur-[2px]" aria-label="Close" />
      <aside className="relative flex h-full w-full max-w-2xl flex-col justify-center border-l border-ink-200 bg-base-100 shadow-2xl">
        <RouteErrorPanel back={{ to: back, label: "Back to the board" }} />
      </aside>
    </div>
  );
}

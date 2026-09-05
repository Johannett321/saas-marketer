import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Check, Globe, Link2, Loader2, Newspaper, Shuffle, Sparkles, X } from "lucide-react";
import { WaitingGame } from "./waiting-game";
import { WidgetBoundary } from "./route-error";
import { AiKeyNotice, useHasAiKey } from "./ai-key-notice";

type Mode = "RANDOM" | "NEWS" | "URL";

type Suggestion = {
  id: string;
  title: string;
  angle: string;
  rationale: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

type GenerateResponse =
  | { error: string }
  | { batchId: string; suggestions: Suggestion[]; source: { url: string; title: string } | null };

const MODES: Array<{ id: Mode; label: string; hint: (niche: string | null) => string; icon: typeof Shuffle }> = [
  {
    id: "RANDOM",
    label: "Random ideas",
    hint: () => "The AI invents ideas from scratch — no extra context on the script.",
    icon: Shuffle,
  },
  {
    id: "NEWS",
    label: "Today's news",
    hint: (niche) =>
      niche
        ? `The AI reads today's news in ${niche} and grounds every idea in a story.`
        : "The AI reads today's news for this project and grounds every idea in a story. Set a niche in project settings to focus the search.",
    icon: Newspaper,
  },
  {
    id: "URL",
    label: "From a page",
    hint: () => "Paste a link. The AI reads the article and suggests different angles.",
    icon: Link2,
  },
];

export function IdeaGenerator({
  projectId,
  workspaceSlug,
  niche,
  initialMode = "RANDOM",
  onClose,
}: {
  projectId: string;
  workspaceSlug: string;
  niche: string | null;
  /** Set when the modal is opened from a surface that already picked a source. */
  initialMode?: Mode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generate = useFetcher<GenerateResponse>();
  const accept = useFetcher<{ cardId?: string }>();
  const revalidator = useRevalidator();
  const hasAiKey = useHasAiKey();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [count, setCount] = useState(5);
  const [url, setUrl] = useState("");
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  // Which request the panel below belongs to. Switching mode (or link) must not
  // leave the previous run's suggestions on screen under a different tab.
  const [shownFor, setShownFor] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // refresh the board in the background as cards get created
  useEffect(() => {
    if (accept.state === "idle" && accept.data?.cardId) revalidator.revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accept.state, accept.data]);

  const signature = `${mode}|${mode === "URL" ? url.trim() : ""}`;
  const current = shownFor === signature;

  const busy = generate.state !== "idle" && current;
  const result =
    current && generate.data && "suggestions" in generate.data ? generate.data : null;
  const error =
    current && generate.data && "error" in generate.data ? generate.data.error : null;

  const close = () => {
    dialogRef.current?.close();
    onClose();
  };

  const submit = () => {
    setShownFor(signature);
    generate.submit(
      { intent: "generate", projectId, mode, count: String(count), url },
      { method: "post", action: "/api/ideas" },
    );
  };

  const acceptSuggestion = (s: Suggestion, open: boolean) => {
    setAccepted((prev) => new Set(prev).add(s.id));
    accept.submit(
      { intent: "accept", suggestionId: s.id },
      { method: "post", action: "/api/ideas" },
    );
    if (open) close();
  };

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-h-[88vh] w-full max-w-2xl border border-ink-200 bg-base-100 p-0">
        <header className="flex items-start gap-3 border-b border-ink-200 px-6 py-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Sparkles className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-ink-900">Generate video ideas</h2>
            <p className="text-[13px] text-ink-500">
              Pick where the ideas come from. The source travels with the card as context for the script.
            </p>
          </div>
          <button onClick={close} className="btn btn-ghost btn-sm btn-square" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>

        <div className="max-h-[66vh] overflow-y-auto px-6 py-5">
          {!busy && (
            <>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`rounded-box border p-3 text-left transition-colors ${
                  mode === id
                    ? "border-brand-400 bg-brand-50"
                    : "border-ink-200 hover:border-ink-300 hover:bg-ink-100"
                }`}
              >
                <Icon className={`size-4 ${mode === id ? "text-brand-600" : "text-ink-400"}`} />
                <p
                  className={`mt-2 text-[13px] font-medium ${
                    mode === id ? "text-brand-700" : "text-ink-800"
                  }`}
                >
                  {label}
                </p>
              </button>
            ))}
          </div>

          <p className="mt-2.5 text-[12.5px] text-ink-500">
            {MODES.find((m) => m.id === mode)?.hint(niche)}
          </p>

          {mode === "URL" && (
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Link</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="input w-full bg-base-100"
                autoFocus
              />
            </label>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] text-ink-600">
              Number of ideas
              <select
                className="select select-sm w-20 border-ink-200 bg-base-100"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>

            <button
              onClick={submit}
              disabled={busy || !hasAiKey || (mode === "URL" && !url.trim())}
              className="btn btn-primary btn-sm gap-1.5"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {result ? "Generate again" : "Generate"}
            </button>
          </div>
            </>
          )}

          {busy && (
            <WidgetBoundary label="The waiting game">
              <WaitingGame
                workspaceSlug={workspaceSlug}
              status={
                mode === "NEWS"
                  ? "Searching and reading today\u2019s news…"
                  : mode === "URL"
                    ? "Reading the article…"
                    : "Coming up with ideas…"
                }
              />
            </WidgetBoundary>
          )}

          {!hasAiKey && (
            <div className="mt-5">
              <AiKeyNotice action="Idea generation" />
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-box border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
              {error}
            </div>
          )}

          {result && !busy && (
            <div className="mt-5 space-y-2">
              {result.source && (
                <a
                  href={result.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-box border border-ink-200 bg-ink-100/60 px-3 py-2 text-[12.5px] text-ink-600 hover:border-brand-300"
                >
                  <Globe className="size-3.5 shrink-0 text-ink-400" />
                  <span className="truncate">{result.source.title}</span>
                </a>
              )}

              {result.suggestions.map((s) => {
                const used = accepted.has(s.id);
                return (
                  <div
                    key={s.id}
                    className={`rounded-box border p-3.5 transition-colors ${
                      used ? "border-brand-300 bg-brand-50/60" : "border-ink-200 hover:border-ink-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] leading-snug font-medium text-ink-900">
                          {s.title}
                        </p>
                        {s.angle && (
                          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">
                            <span className="font-medium text-ink-700">Angle:</span> {s.angle}
                          </p>
                        )}
                        {s.rationale && (
                          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
                            {s.rationale}
                          </p>
                        )}
                        {s.sourceUrl && (
                          <a
                            href={s.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[12px] text-brand-600 hover:text-brand-700"
                          >
                            <Link2 className="size-3 shrink-0" />
                            <span className="truncate">{s.sourceTitle ?? s.sourceUrl}</span>
                          </a>
                        )}
                      </div>

                      <button
                        onClick={() => acceptSuggestion(s, false)}
                        disabled={used}
                        className={`btn btn-sm shrink-0 gap-1.5 ${used ? "btn-ghost text-brand-600" : "btn-outline"}`}
                      >
                        {used ? <Check className="size-3.5" /> : null}
                        {used ? "Added" : "Create card"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-ink-200 px-6 py-4">
          <p className="text-[12.5px] text-ink-500">
            {accepted.size > 0 ? `${accepted.size} card${accepted.size === 1 ? "" : "s"} added to Idea` : "Cards land in the Idea column"}
          </p>
          <button onClick={close} className="btn btn-sm btn-ghost">
            Done
          </button>
        </footer>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

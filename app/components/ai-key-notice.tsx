import { useEffect } from "react";
import { useFetcher, useRevalidator, useRouteLoaderData } from "react-router";
import { ExternalLink, KeyRound, Loader2 } from "lucide-react";

/**
 * Whether the signed-in user has stored their own provider key.
 *
 * There is no instance-wide key: every AI call bills the person who made it, so
 * the UI has to say up front when a key is missing rather than letting people
 * wait on a request that will only come back as an error.
 *
 * Read off the app layout's loader data, which is where the flag is computed.
 */
export function useHasAiKey() {
  const data = useRouteLoaderData("routes/app-layout") as { hasAiKey?: boolean } | undefined;
  return data?.hasAiKey ?? false;
}

/**
 * Inline key setup, shown wherever an AI action would otherwise fail.
 *
 * This used to be a sentence pointing at the profile page, which meant the first
 * AI click in a new account ended on a different screen with no way back to what
 * the person was doing. The field is here instead: paste, save, and the button
 * that was disabled a second ago works.
 */
export function AiKeyNotice({ action }: { action: string }) {
  const save = useFetcher<{ ok?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const saving = save.state !== "idle";

  // `hasAiKey` lives on the app layout's loader, so the surrounding UI only
  // unlocks once that has been re-run.
  useEffect(() => {
    if (save.state === "idle" && save.data?.ok) revalidator.revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.state, save.data]);

  return (
    <div className="rounded-box border border-brand-200 bg-brand-50/60 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-700">
            {action} runs on your own OpenAI key, billed to you at cost. It is encrypted before
            it is stored and only ever used for calls you trigger.
          </p>

          <save.Form
            method="post"
            action="/api/ai-key"
            className="mt-2.5 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="intent" value="save" />
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              aria-label="OpenAI API key"
              className="input input-sm min-w-0 flex-1 bg-base-100 font-mono text-[13px]"
              required
            />
            <button className="btn btn-primary btn-sm gap-1.5" disabled={saving}>
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save key
            </button>
          </save.Form>

          {save.data?.error && (
            <p className="mt-1.5 text-[12.5px] text-error">{save.data.error}</p>
          )}

          <p className="mt-2 text-[12px] text-ink-500">
            <a
              className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800"
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
            >
              Create a key at platform.openai.com <ExternalLink className="size-3" />
            </a>
            {" · "}
            change it later under Profile → AI provider.
          </p>
        </div>
      </div>
    </div>
  );
}

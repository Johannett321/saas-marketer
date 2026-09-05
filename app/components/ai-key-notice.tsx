import { Link, useRouteLoaderData } from "react-router";
import { KeyRound } from "lucide-react";

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

/** Inline "add your key" prompt, shown wherever an AI action would otherwise fail. */
export function AiKeyNotice({ action }: { action: string }) {
  return (
    <div className="flex items-start gap-3 rounded-box border border-brand-200 bg-brand-50/60 px-4 py-3 text-[13px]">
      <KeyRound className="mt-0.5 size-4 shrink-0 text-brand-600" />
      <p className="text-ink-700">
        {action} runs on your own OpenAI key, and you have not added one yet.{" "}
        <Link to="/app/profile" className="link font-medium text-brand-700">
          Add it in your profile
        </Link>{" "}
        — it is encrypted at rest and only ever used for calls you trigger.
      </p>
    </div>
  );
}

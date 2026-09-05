import { BoardPreview } from "./board-preview";

/**
 * The right half of the auth screens: what the account is for, and — on signup —
 * how short the path to a filled board is. Nothing is ticked here: the account
 * does not exist yet, and a head start has to correspond to something the person
 * actually did or it gets found out on the very next screen.
 */
const STEPS = ["Create your account", "Name your board", "Generate your first ideas"];

export function AuthAside({ showSteps = false }: { showSteps?: boolean }) {
  return (
    <aside className="relative hidden overflow-hidden border-l border-ink-200 lg:block">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-100/70 via-transparent to-secondary/8" />
      <div className="relative flex h-full flex-col justify-center gap-8 px-14">
        <blockquote className="max-w-md">
          <p className="text-2xl leading-snug font-medium text-balance text-ink-900">
            &ldquo;Five columns, one board — and an AI writing the scripts while you plan
            next week.&rdquo;
          </p>
        </blockquote>

        <div className="glass rounded-box p-4">
          <BoardPreview dense />
        </div>

        {showSteps && (
          <div>
            <p className="text-[12px] font-semibold tracking-wider text-ink-400 uppercase">
              Three steps to a full board
            </p>
            <ol className="mt-3 flex flex-col gap-2.5">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-2.5 text-[13px]">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border border-ink-300 bg-base-100 text-[10px] font-semibold text-ink-500">
                    {i + 1}
                  </span>
                  <span className="text-ink-600">{label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </aside>
  );
}

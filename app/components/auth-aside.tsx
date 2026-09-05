import { STAGES } from "~/lib/stages";

/** Decorative half of the auth screens — a stylised board on the brand aurora. */
export function AuthAside() {
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
          <div className="grid grid-cols-5 gap-2.5">
            {STAGES.map((stage, i) => (
              <div key={stage.id}>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${stage.dot}`} />
                  <span className="truncate text-[10px] text-ink-500">{stage.short}</span>
                </div>
                <div className="space-y-1.5">
                  {Array.from({ length: [3, 2, 1, 2, 1][i] }).map((_, j) => (
                    <div
                      key={j}
                      className="rounded-lg border border-ink-200 bg-ink-100 p-2"
                      style={{ animation: `fade-up .5s ${i * 60 + j * 90}ms both` }}
                    >
                      <div className={`h-1 w-6 rounded-full bg-gradient-to-r ${stage.bar}`} />
                      <div className="mt-1.5 h-1 w-full rounded-full bg-ink-150" />
                      <div className="mt-1 h-1 w-2/3 rounded-full bg-ink-150" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

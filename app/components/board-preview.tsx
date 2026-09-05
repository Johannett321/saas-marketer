import { FileText, Link2, Sparkles } from "lucide-react";
import { STAGES } from "~/lib/stages";

/**
 * A non-interactive replica of a real board, used on the marketing surfaces.
 *
 * The previous version drew grey placeholder bars, which showed a visitor
 * nothing about the product they are being asked to sign up for. These are the
 * same tiles the board renders, with copy in them, so the screenshot argues for
 * the app on its own.
 */
type PreviewCard = {
  title: string;
  angle?: string;
  badge?: "AI generated" | "From the news" | "From a page";
  link?: boolean;
  script?: boolean;
  /** Initials + hue for the little assignee dot; omitted means unassigned. */
  who?: [string, number];
};

const CARDS: PreviewCard[][] = [
  [
    {
      title: "Why your best users never open the dashboard",
      angle: "The value happens somewhere else entirely.",
      badge: "AI generated",
      who: ["ML", 280],
    },
    {
      title: "Three onboarding emails that beat a product tour",
      badge: "From the news",
      link: true,
    },
    { title: "You don't have a churn problem, you have a segment problem" },
  ],
  [
    {
      title: "Your changelog is a retention feature",
      angle: "Shipping quietly is why people forget they pay you.",
      script: true,
      who: ["PR", 145],
    },
    { title: "The demo call you should have replaced with a Loom", badge: "AI generated", who: ["SO", 25] },
  ],
  [
    {
      title: "What a 40% trial-to-paid rate actually looks like",
      badge: "From a page",
      link: true,
      script: true,
      who: ["TB", 205],
    },
    { title: "Pricing pages that answer the wrong question", script: true, who: ["ML", 280] },
  ],
  [{ title: "Stop A/B testing your empty state", script: true, who: ["TB", 205] }],
  [
    { title: "The metric your investors ask about first", script: true, who: ["PR", 145] },
    { title: "Six months of shipping, one honest recap", script: true, who: ["SO", 25] },
  ],
];

function Who({ initials, hue }: { initials: string; hue: number }) {
  return (
    <span
      className="grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${(hue + 38) % 360} 75% 45%))`,
      }}
    >
      {initials}
    </span>
  );
}

/**
 * @param dense - the tighter type scale used in the narrow auth column.
 */
export function BoardPreview({ dense = false }: { dense?: boolean }) {
  return (
    <div className={`grid grid-cols-5 ${dense ? "gap-2" : "gap-3"}`} aria-hidden>
      {STAGES.map((stage, column) => (
        <div key={stage.id} className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5 px-0.5">
            <span className={`size-1.5 shrink-0 rounded-full ${stage.dot}`} />
            <span
              className={`truncate font-medium text-ink-600 ${dense ? "text-[10px]" : "text-[11px]"}`}
            >
              {stage.short}
            </span>
            <span
              className={`ml-auto text-ink-400 ${dense ? "text-[9px]" : "text-[10px]"}`}
            >
              {CARDS[column].length}
            </span>
          </div>

          <div className={dense ? "space-y-1.5" : "space-y-2"}>
            {CARDS[column].map((card, i) => (
              <div
                key={card.title}
                className={`rounded-selector border border-ink-200 bg-base-100 shadow-[0_1px_2px_hsl(274_40%_8%/0.04)] ${
                  dense ? "p-2" : "p-2.5"
                }`}
                style={{ animation: `fade-up .5s ${column * 70 + i * 90}ms both` }}
              >
                <p
                  className={`leading-snug font-medium text-ink-900 ${
                    dense ? "text-[10px]" : "text-[11.5px]"
                  }`}
                >
                  {card.title}
                </p>

                {card.angle && !dense && (
                  <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-ink-500">
                    {card.angle}
                  </p>
                )}

                {(card.badge || card.script || card.who) && (
                  <div className="mt-2 flex items-center gap-1">
                    {card.badge && (
                      <span
                        className={`inline-flex min-w-0 items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700 ${
                          dense ? "text-[8.5px]" : "text-[9.5px]"
                        }`}
                      >
                        <Sparkles className="size-2 shrink-0" />
                        <span className="truncate">{card.badge}</span>
                      </span>
                    )}
                    {card.link && <Link2 className="size-2.5 shrink-0 text-ink-400" />}
                    {card.script && !card.badge && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full bg-ink-100 px-1.5 py-0.5 font-medium text-ink-600 ${
                          dense ? "text-[8.5px]" : "text-[9.5px]"
                        }`}
                      >
                        <FileText className="size-2 shrink-0" /> Script
                      </span>
                    )}
                    {card.who && (
                      <span className="ml-auto">
                        <Who initials={card.who[0]} hue={card.who[1]} />
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

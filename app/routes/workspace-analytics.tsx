import { Link } from "react-router";
import { ChevronLeft, ChevronRight, FileText, TrendingUp, Video } from "lucide-react";
import type { Route } from "./+types/workspace-analytics";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireWorkspace } from "~/lib/workspace.server";
import { STAGES } from "~/lib/stages";
import { Avatar } from "~/components/ui";
import { RouteErrorPanel } from "~/components/route-error";

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `Analytics · ${loaderData?.workspace.name ?? ""} · saas-marketer` },
];

export const handle = { breadcrumb: () => ({ label: "Analytics" }) };

/** Cards that reached "ready to publish" or "scheduled" count as produced. */
const PRODUCED: Array<"READY_TO_PUBLISH" | "SCHEDULED"> = ["READY_TO_PUBLISH", "SCHEDULED"];

/**
 * Every segment carries the same border so the group reads as one control —
 * daisyUI's own `btn-disabled` blanks out `--btn-border`, which would leave the
 * unavailable segment floating borderless between its neighbours. The "no later
 * month" state is a plain span that mutes only its glyph.
 */
const MONTH_SEG_BASE = "btn btn-sm btn-outline join-item border-ink-300 bg-transparent";
const MONTH_SEG = `${MONTH_SEG_BASE} text-ink-600 hover:border-ink-400 hover:bg-ink-100 hover:text-ink-900`;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { workspace } = await requireWorkspace(user.id, params.workspaceSlug!);

  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get("y")) || now.getFullYear();
  const month = url.searchParams.get("m") !== null ? Number(url.searchParams.get("m")) : now.getMonth();

  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  const range = { gte: from, lt: to };

  const projectFilter = { project: { workspaceId: workspace.id } };

  const [producedEvents, revisions, createdCards, stageCounts, prevProduced, prevScripts] =
    await Promise.all([
      // distinct cards that hit a "produced" column in this month
      db.statusEvent.findMany({
        where: { card: projectFilter, toStatus: { in: PRODUCED }, createdAt: range },
        select: { cardId: true, userId: true, toStatus: true },
      }),
      db.scriptRevision.findMany({
        where: { card: projectFilter, createdAt: range },
        select: { createdById: true, cardId: true, source: true },
      }),
      db.videoCard.count({ where: { ...projectFilter, createdAt: range } }),
      db.videoCard.groupBy({
        by: ["status"],
        where: projectFilter,
        _count: { _all: true },
      }),
      db.statusEvent.findMany({
        where: {
          card: projectFilter,
          toStatus: { in: PRODUCED },
          createdAt: { gte: new Date(year, month - 1, 1), lt: from },
        },
        select: { cardId: true },
      }),
      db.scriptRevision.count({
        where: { card: projectFilter, createdAt: { gte: new Date(year, month - 1, 1), lt: from } },
      }),
    ]);

  // de-duplicate: a card that moves publish → scheduled must only count once
  const producedCards = new Map<string, string>(); // cardId -> first userId who produced it
  for (const e of producedEvents) if (!producedCards.has(e.cardId)) producedCards.set(e.cardId, e.userId);

  const perUser = new Map<string, { produced: number; scripts: number; aiScripts: number }>();
  const bump = (id: string, key: "produced" | "scripts" | "aiScripts") => {
    const row = perUser.get(id) ?? { produced: 0, scripts: 0, aiScripts: 0 };
    row[key] += 1;
    perUser.set(id, row);
  };
  for (const [, userId] of producedCards) bump(userId, "produced");
  for (const r of revisions) {
    bump(r.createdById, "scripts");
    if (r.source !== "MANUAL") bump(r.createdById, "aiScripts");
  }

  const prevProducedCount = new Set(prevProduced.map((e) => e.cardId)).size;

  return {
    workspace: { name: workspace.name, slug: workspace.slug },
    period: { year, month, label: `${MONTHS[month]} ${year}` },
    totals: {
      produced: producedCards.size,
      scripts: revisions.length,
      created: createdCards,
      prevProduced: prevProducedCount,
      prevScripts,
    },
    stageCounts: Object.fromEntries(
      stageCounts.map((s) => [s.status, s._count._all]),
    ) as Record<string, number>,
    members: workspace.members
      .map((m) => ({
        ...m.user,
        ...(perUser.get(m.userId) ?? { produced: 0, scripts: 0, aiScripts: 0 }),
      }))
      .sort((a, b) => b.produced - a.produced || b.scripts - a.scripts),
  };
}

export default function Analytics({ loaderData }: Route.ComponentProps) {
  const { workspace, period, totals, members, stageCounts } = loaderData;

  const prevMonth = new Date(period.year, period.month - 1, 1);
  const nextMonth = new Date(period.year, period.month + 1, 1);
  const isCurrent =
    period.year === new Date().getFullYear() && period.month === new Date().getMonth();

  const link = (d: Date) => `?y=${d.getFullYear()}&m=${d.getMonth()}`;
  const maxProduced = Math.max(1, ...members.map((m) => m.produced));
  const maxScripts = Math.max(1, ...members.map((m) => m.scripts));

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Analytics</h1>
            <p className="mt-1 text-ink-500">
              {workspace.name} · <span className="capitalize">{period.label}</span>
            </p>
          </div>

          <div className="join">
            <Link to={link(prevMonth)} className={MONTH_SEG} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Link>
            <Link to="." className={MONTH_SEG}>
              This month
            </Link>
            {isCurrent ? (
              <span
                aria-disabled="true"
                aria-label="Next month"
                title="This is the most recent month"
                className={`${MONTH_SEG_BASE} text-ink-300`}
              >
                <ChevronRight className="size-4" />
              </span>
            ) : (
              <Link to={link(nextMonth)} className={MONTH_SEG} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat
            icon={<Video className="size-4" />}
            label="Videos produced"
            value={totals.produced}
            delta={totals.produced - totals.prevProduced}
            hint="Cards that reached publishing or scheduling"
          />
          <Stat
            icon={<FileText className="size-4" />}
            label="Scripts written"
            value={totals.scripts}
            delta={totals.scripts - totals.prevScripts}
            hint="Every version saved this month"
          />
          <Stat
            icon={<TrendingUp className="size-4" />}
            label="New cards"
            value={totals.created}
            hint="Ideas added this month"
          />
        </div>

        <section className="mt-8 rounded-box border border-ink-200 bg-base-100 p-5">
          <h2 className="text-[13px] font-semibold tracking-wider text-ink-500 uppercase">
            Spread across the board
          </h2>
          <div className="mt-4 space-y-2.5">
            {STAGES.map((s) => {
              const n = stageCounts[s.id] ?? 0;
              const total = Math.max(1, Object.values(stageCounts).reduce((a, b) => a + b, 0));
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-[13px] text-ink-600">{s.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={`h-full rounded-full ${s.dot}`}
                      style={{ width: `${(n / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[13px] tabular-nums text-ink-700">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-box border border-ink-200 bg-base-100">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-ink-200 px-5 py-3 text-[11px] font-medium tracking-wider text-ink-400 uppercase">
            <span>Team member</span>
            <span className="w-28 text-right">Videos</span>
            <span className="w-28 text-right">Scripts</span>
          </div>

          {members.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-ink-150 px-5 py-3.5 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar user={m} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink-900">{m.name}</p>
                  <p className="truncate text-[12px] text-ink-400">
                    {m.aiScripts > 0 ? `${m.aiScripts} with AI` : "—"}
                  </p>
                </div>
              </div>

              <MiniBar value={m.produced} max={maxProduced} className="bg-stage-publish" />
              <MiniBar value={m.scripts} max={maxScripts} className="bg-brand-500" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  delta,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  delta?: number;
  hint: string;
}) {
  return (
    <div className="rounded-box border border-ink-200 bg-base-100 p-5">
      <div className="flex items-center gap-2 text-ink-500">
        <span className="grid size-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </span>
        <span className="text-[13px]">{label}</span>
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-ink-900">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span
            className={`text-[12.5px] font-medium ${delta > 0 ? "text-success" : "text-ink-400"}`}
          >
            {delta > 0 ? "+" : ""}
            {delta} vs. last month
          </span>
        )}
      </p>
      <p className="mt-1 text-[12px] text-ink-400">{hint}</p>
    </div>
  );
}

function MiniBar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="flex w-28 items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${className}`}
          style={{ width: `${(value / max) * 100}%`, opacity: value ? 1 : 0.15 }}
        />
      </div>
      <span className="w-5 text-right text-[13px] tabular-nums text-ink-700">{value}</span>
    </div>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel compact />;
}

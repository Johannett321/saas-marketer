import { Link, redirect } from "react-router";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Globe,
  KanbanSquare,
  Newspaper,
  Sparkles,
  Users,
} from "lucide-react";
import type { Route } from "./+types/home";
import { getUser } from "~/lib/session.server";
import { Logo } from "~/components/ui";
import { STAGES } from "~/lib/stages";

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) throw redirect("/app");
  return null;
}

const FEATURES = [
  {
    icon: KanbanSquare,
    title: "A board built for video",
    body: "Five columns from idea to scheduled. Drag cards along as production moves.",
  },
  {
    icon: Sparkles,
    title: "AI-generated ideas",
    body: "Batch out ten titles from thin air, from today's news in your niche, or from an article you paste in.",
  },
  {
    icon: Bot,
    title: "Scripts in one click",
    body: "The AI searches the web, reads the sources and writes the script in markdown. Sharpen it with one more click.",
  },
  {
    icon: Globe,
    title: "Page to video",
    body: "Paste a link and pick from five different angles — the article travels with the card as context.",
  },
  {
    icon: Users,
    title: "Built for teams",
    body: "Invite your team, assign videos, comment on cards, and see every change live as it happens.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "See how many videos and scripts shipped this month — for the workspace and per team member.",
  },
];

export default function Home() {
  return (
    <div className="relative z-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link to="/login" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
          <Link to="/signup" className="btn btn-primary btn-sm">
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-16 pb-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-[13px] text-brand-700 animate-fade-in">
            <Sparkles className="size-3.5" />
            Jira, but for marketing video
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-ink-900 sm:text-6xl animate-fade-up">
            From <span className="text-gradient">idea</span> to published video
            <br className="hidden sm:block" /> without losing the thread
          </h1>

          <p
            className="mx-auto mt-6 max-w-xl text-lg text-pretty text-ink-600 animate-fade-up"
            style={{ animationDelay: "80ms" }}
          >
            Plan production on a kanban board, let AI generate ideas and scripts from real
            sources, and keep track of what your team actually ships.
          </p>

          <div
            className="mt-9 flex flex-wrap items-center justify-center gap-3 animate-fade-up"
            style={{ animationDelay: "160ms" }}
          >
            <Link to="/signup" className="btn btn-primary btn-lg gap-2">
              Create a workspace <ArrowRight className="size-4" />
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg border-ink-300 hover:border-ink-400">
              I already have an account
            </Link>
          </div>
        </section>

        {/* board preview */}
        <section
          className="relative animate-fade-up"
          style={{ animationDelay: "240ms" }}
          aria-hidden
        >
          <div className="pointer-events-none absolute -inset-x-10 -top-8 bottom-0 rounded-[2rem] bg-brand-100/50 blur-3xl" />
          <div className="glass relative overflow-hidden rounded-box p-4 shadow-2xl">
            <div className="mb-3 flex items-center gap-1.5 px-2">
              <span className="size-2.5 rounded-full bg-ink-200" />
              <span className="size-2.5 rounded-full bg-ink-200" />
              <span className="size-2.5 rounded-full bg-ink-200" />
              <span className="ml-3 text-xs text-ink-500">Acme / Launch series</span>
            </div>
            <div className="grid grid-cols-5 gap-3 overflow-hidden">
              {STAGES.map((stage, i) => (
                <div key={stage.id} className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className={`size-1.5 rounded-full ${stage.dot}`} />
                    <span className="truncate text-[11px] font-medium text-ink-600">{stage.short}</span>
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: [3, 2, 2, 1, 2][i] }).map((_, j) => (
                      <div
                        key={j}
                        className="rounded-selector border border-ink-200 bg-ink-100 p-2.5"
                      >
                        <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${stage.bar}`} />
                        <div className="mt-2 h-1.5 w-full rounded-full bg-ink-150" />
                        <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-ink-150" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-box border border-ink-200 bg-base-100 p-6 transition-colors hover:border-brand-300 hover:bg-brand-50/60"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-medium text-ink-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>
            </div>
          ))}
        </section>

        <section className="mb-24 overflow-hidden rounded-box border border-brand-200 bg-gradient-to-br from-brand-50 via-brand-50/50 to-transparent p-10 text-center">
          <Newspaper className="mx-auto size-7 text-brand-600" />
          <h2 className="mt-4 text-2xl font-semibold text-ink-900">
            Empty board? Let AI fill it.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-ink-600">
            One click on &ldquo;Today&rsquo;s news&rdquo; gives you five ready angles from your
            niche, each with its source attached as context for the script.
          </p>
          <Link to="/signup" className="btn btn-primary mt-6 gap-2">
            Try it <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-ink-200 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-sm text-ink-400">
          <span>saas-marketer</span>
          <span>Built for teams that publish often</span>
        </div>
      </footer>
    </div>
  );
}

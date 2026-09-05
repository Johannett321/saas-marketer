import { Link, redirect } from "react-router";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Globe,
  KanbanSquare,
  KeyRound,
  Newspaper,
  Sparkles,
  Users,
} from "lucide-react";
import type { Route } from "./+types/home";
import { getUser } from "~/lib/session.server";
import { Logo } from "~/components/ui";
import { BoardPreview } from "~/components/board-preview";

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) throw redirect("/app");
  return null;
}

/** The path from signing up to a script, so the visitor can see how short it is. */
const STEPS = [
  {
    title: "Name a board",
    body: "One field. Say who the videos are for and the AI keeps that in mind from then on.",
  },
  {
    title: "Fill it in a click",
    body: "Ten titles from today's news in your niche, from an article you paste in, or from nothing at all.",
  },
  {
    title: "Let it write the script",
    body: "The AI reads the sources and drafts in markdown. You edit it in place and move the card along.",
  },
];

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
              Start your first board <ArrowRight className="size-4" />
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg border-ink-300 hover:border-ink-400">
              I already have an account
            </Link>
          </div>

          <p
            className="mt-4 text-[13px] text-ink-400 animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            Self-hosted and MIT-licensed · no card, no seats, no telemetry
          </p>
        </section>

        {/* board preview — the real tiles, not a placeholder */}
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
            <BoardPreview />
          </div>
        </section>

        {/* how it works — three steps, so the path is visible before signing up */}
        <section className="pt-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-ink-900">
            A board with ten ideas on it, in about two minutes
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-box border border-ink-200 bg-base-100 p-6"
              >
                <span className="grid size-7 place-items-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-700">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-medium text-ink-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{step.body}</p>
              </li>
            ))}
          </ol>
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

        {/* said plainly here rather than sprung on people at the first AI click */}
        <section className="mb-6 flex flex-wrap items-start gap-4 rounded-box border border-ink-200 bg-base-100 p-6">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <KeyRound className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-ink-900">The AI runs on your own OpenAI key</h3>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500">
              You paste it the first time you ask for something, right where you are, and every
              generation after that is billed to you at cost — no markup, no per-seat AI plan. It
              is encrypted before it is stored, never sent to the browser, and nobody else in your
              workspace can use it. The board, the editor, your team and the analytics all work
              without one.
            </p>
          </div>
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
            Start your first board <ArrowRight className="size-4" />
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

import { useEffect, useState } from "react";
import { Form, data, redirect, useFetcher, useNavigation, useSubmit } from "react-router";
import { Globe, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import type { Route } from "./+types/project-settings";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireProject } from "~/lib/workspace.server";
import { useConfirm } from "~/components/confirm";
import { RouteErrorPanel } from "~/components/route-error";

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `Settings · ${loaderData?.project.name ?? "Project"} · saas-marketer` },
];

export const handle = { breadcrumb: () => ({ label: "Settings" }) };

type ProjectProfile = {
  name: string;
  niche: string;
  description: string;
  crawled: string[];
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { workspace, project } = await requireProject(
    user.id,
    params.workspaceSlug!,
    params.projectSlug!,
  );
  const cardCount = await db.videoCard.count({ where: { projectId: project.id } });

  return {
    workspaceSlug: workspace.slug,
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      niche: project.niche,
      description: project.description,
    },
    cardCount,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { workspace, project } = await requireProject(
    user.id,
    params.workspaceSlug!,
    params.projectSlug!,
  );

  const form = await request.formData();

  if (form.get("intent") === "delete") {
    await db.project.delete({ where: { id: project.id } });
    return redirect(`/app/${workspace.slug}`);
  }

  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return data({ error: "Give the project a name" }, { status: 400 });

  await db.project.update({
    where: { id: project.id },
    data: {
      name,
      niche: String(form.get("niche") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim() || null,
    },
  });

  return { ok: true };
}

export default function ProjectSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { project, cardCount } = loaderData;
  const nav = useNavigation();
  const profile = useFetcher<{ profile?: ProjectProfile; error?: string }>();

  // Controlled so the crawl can fill them in — the user still has to hit Save.
  const [name, setName] = useState(project.name);
  const [niche, setNiche] = useState(project.niche ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    setName(project.name);
    setNiche(project.niche ?? "");
    setDescription(project.description ?? "");
  }, [project.id, project.name, project.niche, project.description]);

  const filled = profile.data?.profile;
  useEffect(() => {
    if (!filled) return;
    if (filled.name) setName(filled.name);
    if (filled.niche) setNiche(filled.niche);
    if (filled.description) setDescription(filled.description);
  }, [filled]);
  const submit = useSubmit();
  const { confirm, dialog } = useConfirm();
  const busy = nav.state !== "idle";
  const saved = actionData && "ok" in actionData;
  const profiling = profile.state !== "idle";

  const runProfile = () =>
    profile.submit(
      { projectId: project.id, url: siteUrl },
      { method: "post", action: "/api/project-profile" },
    );
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Project settings</h1>
        <p className="mt-1 text-ink-500">
          The niche and description are given to the AI as context every time it generates
          ideas or writes a script.
        </p>

        <section className="mt-8 rounded-box border border-brand-200 bg-brand-50/40 p-5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wider text-brand-700 uppercase">
            <Wand2 className="size-3.5" /> Fill from a website
          </h2>
          <p className="mt-1.5 text-[13px] text-ink-600">
            Paste a company or product URL. The AI reads the page and a few of its
            sub-pages, then fills in the fields below for you to review.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="input min-w-[16rem] flex-1 bg-base-100"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runProfile();
                }
              }}
            />
            <button
              type="button"
              onClick={runProfile}
              disabled={profiling || !siteUrl.trim()}
              className="btn btn-primary gap-1.5"
            >
              {profiling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {profiling ? "Reading site…" : "Fill in"}
            </button>
          </div>

          {profile.data?.error && (
            <p className="mt-2 text-[13px] text-error">{profile.data.error}</p>
          )}

          {filled && !profiling && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-500">
              <Globe className="size-3.5 shrink-0" />
              Read {filled.crawled.length} page{filled.crawled.length === 1 ? "" : "s"} — review
              the fields below, then save.
            </p>
          )}
        </section>

        <Form method="post" className="mt-4 space-y-5 rounded-box border border-ink-200 bg-base-100 p-6">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="name">
              Project name
            </label>
            <input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full bg-base-100"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="niche">
              Niche
            </label>
            <input
              id="niche"
              name="niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. indie game devs, personal finance, home fitness"
              className="input w-full bg-base-100"
            />
            <p className="mt-1.5 text-[12.5px] text-ink-400">
              Who the videos are for. Drives the ideas and the news search.
            </p>
          </div>

          <div>
            <label
              className="mb-1.5 block text-[13px] font-medium text-ink-700"
              htmlFor="description"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this project covers, the angle you take, anything the AI should know."
              className="textarea w-full border-ink-200 bg-base-100"
            />
          </div>

          {error && <p className="text-[13px] text-error">{error}</p>}

          <div className="flex items-center gap-3">
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </button>
            {saved && !busy && <span className="text-[13px] text-success">Saved</span>}
          </div>
        </Form>

        <section className="mt-6 rounded-box border border-error/25 bg-error/[0.03] p-6">
          <h2 className="text-[13px] font-semibold tracking-wider text-error uppercase">
            Danger zone
          </h2>
          <p className="mt-2 text-[13.5px] text-ink-600">
            Deleting this project removes its board and all {cardCount} card
            {cardCount === 1 ? "" : "s"}, including scripts and comments. This cannot be undone.
          </p>
          <Form
            method="post"
            className="mt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const ok = await confirm({
                title: `Delete "${project.name}"?`,
                description: `This removes the board and all ${cardCount} card${
                  cardCount === 1 ? "" : "s"
                }, including scripts, comments and history. This cannot be undone.`,
                confirmLabel: "Delete project",
                danger: true,
              });
              if (ok) submit(form);
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <button className="btn btn-outline btn-sm gap-1.5 border-error/40 text-error hover:bg-error hover:text-error-content">
              <Trash2 className="size-3.5" /> Delete project
            </button>
          </Form>
        </section>
      </div>

      {dialog}
    </main>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel compact />;
}

import { useEffect, useRef } from "react";
import { Form, Link, useNavigation } from "react-router";
import { FolderKanban, Plus, Sparkles } from "lucide-react";
import type { Route } from "./+types/workspace-index";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireWorkspace } from "~/lib/workspace.server";
import { Avatar } from "~/components/ui";
import { STAGES } from "~/lib/stages";
import { RouteErrorPanel } from "~/components/route-error";

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `${loaderData?.workspace.name ?? "Workspace"} · saas-marketer` },
];

export const handle = { breadcrumb: () => ({ label: "Projects" }) };

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { workspace } = await requireWorkspace(user.id, params.workspaceSlug!);

  const counts = await db.videoCard.groupBy({
    by: ["projectId", "status"],
    where: { project: { workspaceId: workspace.id } },
    _count: { _all: true },
  });

  const projects = workspace.projects.map((p) => {
    const byStatus = Object.fromEntries(
      counts.filter((c) => c.projectId === p.id).map((c) => [c.status, c._count._all]),
    ) as Record<string, number>;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      niche: p.niche,
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
    };
  });

  return {
    workspace: { name: workspace.name, slug: workspace.slug },
    projects,
    members: workspace.members.map((m) => m.user),
  };
}

export default function WorkspaceIndex({ loaderData }: Route.ComponentProps) {
  const { workspace, projects, members } = loaderData;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigation = useNavigation();

  useEffect(() => {
    if (navigation.state === "loading") dialogRef.current?.close();
  }, [navigation.state]);

  const open = () => dialogRef.current?.showModal();

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{workspace.name}</h1>
            <p className="mt-1 text-ink-500">
              {projects.length === 0
                ? "No projects yet."
                : `${projects.length} project${projects.length === 1 ? "" : "s"} · ${members.length} member${members.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to={`/app/${workspace.slug}/members`} className="flex -space-x-2" title="Members">
              {members.slice(0, 5).map((m) => (
                <Avatar key={m.id} user={m} size={30} className="ring-2 ring-white" />
              ))}
            </Link>
            {projects.length > 0 && (
              <button className="btn btn-primary btn-sm gap-1.5" onClick={open}>
                <Plus className="size-4" /> New project
              </button>
            )}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="mt-10 overflow-hidden rounded-box border border-ink-200 bg-base-100">
            <div className="border-b border-ink-200 bg-gradient-to-br from-brand-50 to-transparent px-8 py-12 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <Sparkles className="size-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-ink-900">Create your first project</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
                Every project gets its own board with five columns — from idea to scheduled.
              </p>
              <button className="btn btn-primary mt-6 gap-1.5" onClick={open}>
                <Plus className="size-4" /> New project
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3 p-5 opacity-50" aria-hidden>
              {STAGES.map((s) => (
                <div key={s.id}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${s.dot}`} />
                    <span className="truncate text-[11px] text-ink-500">{s.short}</span>
                  </div>
                  <div className="h-16 rounded-selector border border-dashed border-ink-200" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/app/${workspace.slug}/p/${p.slug}`}
                className="group rounded-box border border-ink-200 bg-base-100 p-5 transition-all hover:border-brand-300 hover:shadow-[0_2px_16px_-6px_hsl(284_87%_56%/0.28)]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <FolderKanban className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{p.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {p.niche ? p.niche : `${p.total} card${p.total === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex h-1.5 gap-1 overflow-hidden rounded-full">
                  {STAGES.map((s) => {
                    const n = p.byStatus[s.id] ?? 0;
                    return (
                      <span
                        key={s.id}
                        className={s.dot}
                        style={{ flex: n || 0.08, opacity: n ? 1 : 0.2 }}
                        title={`${s.label}: ${n}`}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-ink-400">
                  <span>Idea {p.byStatus.IDEA ?? 0}</span>
                  <span>Scheduled {p.byStatus.SCHEDULED ?? 0}</span>
                </div>
              </Link>
            ))}

            <button
              onClick={open}
              className="flex min-h-[7.5rem] items-center justify-center gap-2 rounded-box border border-dashed border-ink-300 text-sm text-ink-400 transition-colors hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600"
            >
              <Plus className="size-4" /> New project
            </button>
          </div>
        )}
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg border border-ink-200 bg-base-100">
          <h3 className="text-lg font-semibold text-ink-900">New project</h3>
          <p className="mt-1 text-sm text-ink-500">
            The niche and description are given to the AI as context whenever it generates
            ideas or writes a script. You can change them later in project settings.
          </p>

          <Form method="post" action={`/app/${workspace.slug}/projects`} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="p-name">
                Project name
              </label>
              <input
                id="p-name"
                name="name"
                placeholder="e.g. Q3 launch series"
                className="input w-full bg-base-100"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="p-niche">
                Niche
              </label>
              <input
                id="p-niche"
                name="niche"
                placeholder="e.g. indie game devs, personal finance, home fitness"
                className="input w-full bg-base-100"
              />
              <p className="mt-1.5 text-[12.5px] text-ink-400">
                Who the videos are for. Drives the ideas and the news search.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="p-desc">
                Description <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <textarea
                id="p-desc"
                name="description"
                rows={3}
                placeholder="What this project covers and the angle you take."
                className="textarea w-full border-ink-200 bg-base-100"
              />
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button className="btn btn-primary">Create project</button>
            </div>
          </Form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </main>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel back={{ to: "/app", label: "Back to your workspaces" }} />;
}

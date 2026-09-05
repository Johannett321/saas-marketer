import { Link, redirect } from "react-router";
import { FolderKanban, Plus, Users } from "lucide-react";
import type { Route } from "./+types/app-index";
import { requireUser } from "~/lib/session.server";
import { listWorkspaces } from "~/lib/workspace.server";
import { EmptyState } from "~/components/ui";

export const meta = () => [{ title: "Workspaces · saas-marketer" }];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const workspaces = await listWorkspaces(user.id);
  if (workspaces.length === 1) throw redirect(`/app/${workspaces[0].slug}`);
  if (workspaces.length === 0) throw redirect("/app/new");
  return { workspaces };
}

export default function AppIndex({ loaderData }: Route.ComponentProps) {
  const { workspaces } = loaderData;
  return (
    <main className="min-h-0 flex-1 overflow-y-auto mx-auto w-full max-w-4xl px-6 py-14">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Your workspaces</h1>
          <p className="mt-1 text-ink-500">Pick a workspace to get to its boards.</p>
        </div>
        <Link to="/app/new" className="btn btn-primary btn-sm gap-1.5">
          <Plus className="size-4" /> New
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {workspaces.map((w) => (
          <Link
            key={w.id}
            to={`/app/${w.slug}`}
            className="group rounded-box border border-ink-200 bg-base-100 p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/70"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl text-lg font-bold text-white brand-gradient">
                {w.name[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-900">{w.name}</p>
                <p className="flex items-center gap-3 text-xs text-ink-400">
                  <span className="flex items-center gap-1">
                    <FolderKanban className="size-3.5" /> {w._count.projects} project
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" /> {w._count.members} member
                  </span>
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {workspaces.length === 0 && (
        <div className="mt-8">
          <EmptyState
            title="No workspaces yet"
            description="Create your first workspace to get started."
            action={
              <Link to="/app/new" className="btn btn-primary btn-sm">
                Create workspace
              </Link>
            }
          />
        </div>
      )}
    </main>
  );
}

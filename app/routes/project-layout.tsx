import { Outlet } from "react-router";
import type { Route } from "./+types/project-layout";
import { requireUser } from "~/lib/session.server";
import { requireProject } from "~/lib/workspace.server";
import { LevelView } from "~/components/level-transition";
import { RouteErrorPanel } from "~/components/route-error";

/**
 * The project level — one step in from the workspace. Like its sibling, the
 * sidebar is rendered by the app layout; this route guards access and marks the
 * level boundary.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { workspace, project } = await requireProject(
    user.id,
    params.workspaceSlug!,
    params.projectSlug!,
  );
  // The app layout reads this back off the matches to fill the sidebar.
  return {
    workspace: { name: workspace.name, slug: workspace.slug },
    project: { name: project.name, slug: project.slug, niche: project.niche },
  };
}

export default function ProjectLayout() {
  return (
    <LevelView className="flex min-w-0 flex-1 flex-col">
      <Outlet />
    </LevelView>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel back={{ to: "/app", label: "Back to your workspaces" }} />;
}

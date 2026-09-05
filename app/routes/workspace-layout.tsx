import { Outlet } from "react-router";
import type { Route } from "./+types/workspace-layout";
import { requireUser } from "~/lib/session.server";
import { requireWorkspace } from "~/lib/workspace.server";
import { LevelView } from "~/components/level-transition";
import { RouteErrorPanel } from "~/components/route-error";

/**
 * The workspace level. The sidebar itself lives in the app layout so its frame
 * survives the step into a project — this route only guards access and marks
 * the level boundary that `LevelView` animates on.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { workspace } = await requireWorkspace(user.id, params.workspaceSlug!);
  // The app layout reads this back off the matches to fill the sidebar.
  return {
    workspace: { name: workspace.name, slug: workspace.slug },
    projectCount: workspace.projects.length,
    memberCount: workspace.members.length,
  };
}

export default function WorkspaceLayout() {
  return (
    <LevelView className="flex min-w-0 flex-1 flex-col">
      <Outlet />
    </LevelView>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel back={{ to: "/app", label: "Back to your workspaces" }} />;
}

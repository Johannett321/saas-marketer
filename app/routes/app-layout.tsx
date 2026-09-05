import { Form, Link, Outlet, useLocation, useMatches } from "react-router";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronsUpDown,
  FolderKanban,
  KanbanSquare,
  LogOut,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import type { Route } from "./+types/app-layout";
import { requireUser } from "~/lib/session.server";
import { listWorkspaces } from "~/lib/workspace.server";
import { db } from "~/lib/db.server";
import { Avatar, Logo } from "~/components/ui";
import { Breadcrumbs, useCrumbs } from "~/components/breadcrumbs";
import { Realtime } from "~/components/realtime";
import { RouteErrorPanel } from "~/components/route-error";
import { LevelTransitionProvider } from "~/components/level-transition";
import {
  ProjectBadge,
  Sidebar,
  SidebarLink,
  SidebarSection,
  WorkspaceBadge,
} from "~/components/sidebar";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const [workspaces, credentials] = await Promise.all([
    listWorkspaces(user.id),
    // Only whether a key exists — the key itself never leaves the server.
    db.user.findUnique({ where: { id: user.id }, select: { aiApiKey: true } }),
  ]);
  return { user, workspaces, hasAiKey: Boolean(credentials?.aiApiKey) };
}

/** Whether the signed-in user has their own API key stored. See `useHasAiKey`. */
export type AppLayoutData = { hasAiKey: boolean };

/**
 * The sidebar frame is mounted here so it survives the step into a project, but
 * this is a pathless layout — its params never change, so React Router will not
 * re-run its loader on navigation and it cannot load the sidebar's contents
 * itself. Instead each level layout loads its own data and this reads it back
 * off the matches, which keeps the panel in lockstep with the URL.
 */
type WorkspaceLevelData = {
  workspace: { name: string; slug: string };
  projectCount: number;
  memberCount: number;
};

type ProjectLevelData = {
  workspace: { name: string; slug: string };
  project: { name: string; slug: string; niche: string | null };
};

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user, workspaces } = loaderData;
  const location = useLocation();
  const activeSlug = location.pathname.match(/^\/app\/([^/]+)/)?.[1];
  const active = workspaces.find((w) => w.slug === activeSlug);
  const crumbs = useCrumbs();

  const matches = useMatches();
  const workspaceLevel = matches.find((m) => m.id === "routes/workspace-layout")?.loaderData as
    | WorkspaceLevelData
    | undefined;
  const projectLevel = matches.find((m) => m.id === "routes/project-layout")?.loaderData as
    | ProjectLevelData
    | undefined;

  return (
    <LevelTransitionProvider>
        <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
        <header className="sticky top-0 z-40 border-b border-ink-200 bg-base-100/85 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Link to="/app" className="shrink-0">
              <Logo size={26} />
            </Link>

            <span className="mx-1 h-5 w-px bg-ink-200" />

            <div className="dropdown">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-sm gap-2 font-medium text-ink-800"
              >
                {active ? (
                  <>
                    <span
                      className="grid size-5 place-items-center rounded-md text-[10px] font-bold text-white brand-gradient"
                      aria-hidden
                    >
                      {active.name[0]?.toUpperCase()}
                    </span>
                    <span className="max-w-[10rem] truncate">{active.name}</span>
                  </>
                ) : (
                  <span className="text-ink-500">Select workspace</span>
                )}
                <ChevronsUpDown className="size-3.5 text-ink-500" />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu z-50 mt-2 w-64 rounded-box border border-ink-200 bg-base-100 p-2 shadow-xl"
              >
                <li className="menu-title text-[11px] tracking-wide text-ink-400">Workspaces</li>
                {workspaces.map((w) => (
                  <li key={w.id}>
                    <Link to={`/app/${w.slug}`} className="justify-between">
                      <span className="flex items-center gap-2 truncate">
                        <span className="grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white brand-gradient">
                          {w.name[0]?.toUpperCase()}
                        </span>
                        <span className="truncate">{w.name}</span>
                      </span>
                      {w.slug === activeSlug && <Check className="size-4 text-brand-400" />}
                    </Link>
                  </li>
                ))}
                <li className="mt-1 border-t border-ink-200 pt-1">
                  <Link to="/app/new" className="text-brand-600">
                    <Plus className="size-4" /> New workspace
                  </Link>
                </li>
              </ul>
            </div>

            {active && <Breadcrumbs crumbs={crumbs} />}

            <div className="ml-auto flex items-center gap-2">
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2 px-1.5">
                  <Avatar user={user} size={26} />
                  <span className="hidden text-sm text-ink-700 sm:inline">{user.name}</span>
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu z-50 mt-2 w-56 rounded-box border border-ink-200 bg-base-100 p-2 shadow-xl"
                >
                  <li>
                    <Link to="/app/profile" className="flex items-center gap-2.5">
                      <Avatar user={user} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-800">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-ink-400">{user.email}</span>
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/app/profile" className="text-ink-700">
                      <Settings className="size-4" /> Profile settings
                    </Link>
                  </li>
                  <li className="border-t border-ink-200 pt-1">
                    <Form method="post" action="/logout">
                      <button type="submit" className="flex w-full items-center gap-2 text-ink-700">
                        <LogOut className="size-4" /> Sign out
                      </button>
                    </Form>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {(projectLevel || workspaceLevel) && (
            <Sidebar>
              {projectLevel ? (
                <SidebarSection
                  key={`project:${projectLevel.project.slug}`}
                  badge={<ProjectBadge icon={<KanbanSquare className="size-4" />} />}
                  title={projectLevel.project.name}
                  subtitle={projectLevel.project.niche}
                  eyebrow="Project"
                  back={{
                    to: `/app/${projectLevel.workspace.slug}`,
                    label: projectLevel.workspace.name,
                  }}
                >
                  <SidebarLink
                    to={`/app/${projectLevel.workspace.slug}/p/${projectLevel.project.slug}`}
                    end
                    icon={<KanbanSquare className="size-4" />}
                  >
                    Kanban
                  </SidebarLink>
                  <SidebarLink
                    to={`/app/${projectLevel.workspace.slug}/p/${projectLevel.project.slug}/settings`}
                    icon={<Settings className="size-4" />}
                  >
                    Settings
                  </SidebarLink>
                </SidebarSection>
              ) : (
                workspaceLevel && (
                  <SidebarSection
                    key="workspace"
                    badge={<WorkspaceBadge name={workspaceLevel.workspace.name} />}
                    title={workspaceLevel.workspace.name}
                    subtitle={`${workspaceLevel.memberCount} member${
                      workspaceLevel.memberCount === 1 ? "" : "s"
                    }`}
                    eyebrow="Workspace"
                  >
                    <SidebarLink
                      to={`/app/${workspaceLevel.workspace.slug}`}
                      end
                      icon={<FolderKanban className="size-4" />}
                      count={workspaceLevel.projectCount}
                    >
                      Projects
                    </SidebarLink>
                    <SidebarLink
                      to={`/app/${workspaceLevel.workspace.slug}/analytics`}
                      icon={<BarChart3 className="size-4" />}
                    >
                      Analytics
                    </SidebarLink>
                    <SidebarLink
                      to={`/app/${workspaceLevel.workspace.slug}/members`}
                      icon={<Users className="size-4" />}
                      count={workspaceLevel.memberCount}
                    >
                      Members
                    </SidebarLink>
                  </SidebarSection>
                )
              )}
            </Sidebar>
          )}

          <Outlet />
        </div>

        {active && <Realtime workspaceSlug={active.slug} currentUserId={user.id} />}
      </div>
    </LevelTransitionProvider>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel back={{ to: "/app", label: "Back to your workspaces" }} />;
}

import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  route("invite/:token", "routes/invite.tsx"),

  layout("routes/app-layout.tsx", [
    route("app", "routes/app-index.tsx"),
    route("app/new", "routes/workspace-new.tsx"),
    route("app/profile", "routes/profile.tsx"),
    route("app/:workspaceSlug/projects", "routes/project-create.tsx"),

    // workspace level — sidebar with projects, analytics and members
    layout("routes/workspace-layout.tsx", [
      route("app/:workspaceSlug", "routes/workspace-index.tsx"),
      route("app/:workspaceSlug/analytics", "routes/workspace-analytics.tsx"),
      route("app/:workspaceSlug/members", "routes/workspace-members.tsx"),
    ]),

    // project level — its own sidebar, sharing the workspace sidebar's frame
    layout("routes/project-layout.tsx", [
      route("app/:workspaceSlug/p/:projectSlug", "routes/project-board.tsx", [
        route("card/:cardId", "routes/card-detail.tsx"),
      ]),
      route("app/:workspaceSlug/p/:projectSlug/settings", "routes/project-settings.tsx"),
    ]),
  ]),

  // resource routes for the long-running AI calls
  route("avatar/:userId", "routes/avatar.tsx"),
  route("api/game", "routes/api.game.tsx"),
  route("api/ideas", "routes/api.ideas.tsx"),
  route("api/project-profile", "routes/api.project-profile.tsx"),
  route("api/stream/:workspaceSlug", "routes/api.stream.tsx"),
  route("api/script", "routes/api.script.tsx"),
  route("api/title", "routes/api.title.tsx"),
] satisfies RouteConfig;

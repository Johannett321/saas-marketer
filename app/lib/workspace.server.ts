import { data } from "react-router";
import { db } from "./db.server";
import type { WorkspaceRole } from "~/generated/prisma/enums";

const RANK: Record<WorkspaceRole, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 };

/** Every workspace the user belongs to, newest membership last. */
export function listWorkspaces(userId: string) {
  return db.workspace.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { projects: true, members: true } },
    },
  });
}

/** Loads a workspace by slug, 404-ing when the user is not a member. */
export async function requireWorkspace(userId: string, slug: string, minRole: WorkspaceRole = "MEMBER") {
  const workspace = await db.workspace.findUnique({
    where: { slug },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarHue: true, avatarUpdatedAt: true } } },
        orderBy: { createdAt: "asc" },
      },
      projects: { orderBy: { createdAt: "asc" } },
    },
  });

  const membership = workspace?.members.find((m) => m.userId === userId);
  if (!workspace || !membership) throw data("Workspace not found", { status: 404 });
  if (RANK[membership.role] < RANK[minRole]) {
    throw data("You do not have permission to do that", { status: 403 });
  }

  return { workspace, membership, role: membership.role };
}

export async function requireProject(userId: string, workspaceSlug: string, projectSlug: string) {
  const { workspace, membership } = await requireWorkspace(userId, workspaceSlug);
  const project = await db.project.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: projectSlug } },
  });
  if (!project) throw data("Project not found", { status: 404 });
  return { workspace, membership, project };
}

/** Loads a project by id and verifies the user reaches it through a membership. */
export async function requireProjectById(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });
  if (!project) throw data("Project not found", { status: 404 });
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
  });
  if (!membership) throw data("Project not found", { status: 404 });
  return { project, workspace: project.workspace, membership };
}

/** Loads a card and verifies the user can reach it through a workspace membership. */
export async function requireCard(userId: string, cardId: string) {
  const card = await db.videoCard.findUnique({
    where: { id: cardId },
    include: { project: { include: { workspace: true } } },
  });
  if (!card) throw data("Card not found", { status: 404 });
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: card.project.workspaceId, userId } },
  });
  if (!membership) throw data("Card not found", { status: 404 });
  return { card, membership };
}

const RESERVED = new Set(["new", "login", "logout", "signup", "settings", "api", "app", "invite"]);

export function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/\u00e6/g, "ae")
    .replace(/\u00f8/g, "o")
    .replace(/\u00e5/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "workspace";
}

/** Appends -2, -3 … until `taken` says the slug is free. */
export async function uniqueSlug(desired: string, taken: (slug: string) => Promise<boolean>) {
  let slug = slugify(desired);
  if (RESERVED.has(slug)) slug = `${slug}-1`;
  let n = 1;
  while (await taken(slug)) {
    n += 1;
    slug = `${slugify(desired)}-${n}`;
  }
  return slug;
}

import { data, redirect } from "react-router";
import type { Route } from "./+types/project-create";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireWorkspace, uniqueSlug } from "~/lib/workspace.server";

/** Action-only route so any surface in the workspace can create a project. */
export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { workspace } = await requireWorkspace(user.id, params.workspaceSlug!);

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return data({ error: "Give the project a name" }, { status: 400 });

  const slug = await uniqueSlug(name, async (s) =>
    Boolean(
      await db.project.findUnique({
        where: { workspaceId_slug: { workspaceId: workspace.id, slug: s } },
        select: { id: true },
      }),
    ),
  );

  const project = await db.project.create({
    data: {
      workspaceId: workspace.id,
      name,
      slug,
      niche: String(form.get("niche") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim() || null,
    },
  });

  return redirect(`/app/${workspace.slug}/p/${project.slug}`);
}

export async function loader() {
  return redirect("/app");
}

import { Form, Link, data, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Route } from "./+types/workspace-new";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { uniqueSlug } from "~/lib/workspace.server";
import { FieldError } from "~/components/ui";
import { RouteErrorPanel } from "~/components/route-error";

export const meta = () => [{ title: "New workspace · saas-marketer" }];

const Schema = z.object({
  name: z.string().trim().min(2, "Give the workspace a name"),
});

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = Object.fromEntries(await request.formData());
  const parsed = Schema.safeParse(form);
  if (!parsed.success) {
    return data({ errors: z.flattenError(parsed.error).fieldErrors, values: form }, { status: 400 });
  }

  const { name } = parsed.data;
  const slug = await uniqueSlug(name, async (s) =>
    Boolean(await db.workspace.findUnique({ where: { slug: s }, select: { id: true } })),
  );

  const workspace = await db.workspace.create({
    data: { name, slug, members: { create: { userId: user.id, role: "OWNER" } } },
  });

  return redirect(`/app/${workspace.slug}`);
}

export default function WorkspaceNew({ actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const errors = actionData?.errors;
  const values = actionData?.values as Record<string, string> | undefined;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto mx-auto w-full max-w-lg px-6 py-16">
      <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink-900">New workspace</h1>
      <p className="mt-2 text-ink-500">
        A workspace holds your team and all of their projects. You add projects and invite
        people once you are inside.
      </p>

      <Form method="post" className="mt-8 space-y-5" replace>
        <div>
          <label className="block text-[13px] font-medium text-ink-700 mb-1.5" htmlFor="name">
            Workspace name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={values?.name}
            placeholder="Acme Studio"
            className="input w-full bg-base-100"
            autoFocus
            required
          />
          <FieldError>{errors?.name?.[0]}</FieldError>
        </div>

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Create workspace
        </button>
      </Form>
    </main>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel back={{ to: "/app", label: "Back to your workspaces" }} />;
}

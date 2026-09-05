import { Form, Link, data, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import type { Route } from "./+types/workspace-new";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { listWorkspaces, uniqueSlug } from "~/lib/workspace.server";
import { FieldError } from "~/components/ui";
import { RouteErrorPanel } from "~/components/route-error";

export const meta = () => [{ title: "New workspace · saas-marketer" }];

const Schema = z.object({
  name: z.string().trim().min(2, "Give the workspace a name"),
});

/** "Maya Lindqvist" → "Maya's Studio". A name to accept, not a blank to compose. */
function suggestedName(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (!first) return "My Studio";
  return `${first}${first.endsWith("s") ? "'" : "'s"} Studio`;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const workspaces = await listWorkspaces(user.id);
  // A first workspace is onboarding; a second one is a person who already knows
  // what a workspace is, and only needs the one field.
  return { firstRun: workspaces.length === 0, suggestion: suggestedName(user.name) };
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

  // First run creates the board in the same submit, so nobody has to sit through
  // two naming screens before seeing the product.
  const boardName = String(form.boardName ?? "").trim();
  if (boardName.length >= 2) {
    const projectSlug = await uniqueSlug(boardName, async (s) =>
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
        name: boardName,
        slug: projectSlug,
        niche: String(form.niche ?? "").trim() || null,
      },
    });
    return redirect(`/app/${workspace.slug}/p/${project.slug}`);
  }

  return redirect(`/app/${workspace.slug}`);
}

export default function WorkspaceNew({ loaderData, actionData }: Route.ComponentProps) {
  const { firstRun, suggestion } = loaderData;
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const errors = actionData?.errors;
  const values = actionData?.values as Record<string, string> | undefined;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto mx-auto w-full max-w-lg px-6 py-16">
      {firstRun ? (
        // The account is genuinely done, so the checklist starts with a tick
        // rather than at zero.
        <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[12.5px] text-brand-700">
          <Check className="size-3.5" strokeWidth={3} /> Account created · step 2 of 2
        </p>
      ) : (
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
      )}

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink-900">
        {firstRun ? "Set up your first board" : "New workspace"}
      </h1>
      <p className="mt-2 text-ink-500">
        {firstRun
          ? "Everything here is editable later. Accept the defaults and you are on a board in one click."
          : "A workspace holds your team and all of their projects. You add projects and invite people once you are inside."}
      </p>

      <Form method="post" className="mt-8 space-y-5" replace>
        <div>
          <label className="block text-[13px] font-medium text-ink-700 mb-1.5" htmlFor="name">
            Workspace name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={values?.name ?? (firstRun ? suggestion : "")}
            placeholder="Acme Studio"
            className="input w-full bg-base-100"
            autoFocus
            required
          />
          <FieldError>{errors?.name?.[0]}</FieldError>
          {firstRun && (
            <p className="mt-1.5 text-[12.5px] text-ink-400">
              You and the people you invite. Rename it any time in settings.
            </p>
          )}
        </div>

        {firstRun && (
          <>
            <div>
              <label
                className="block text-[13px] font-medium text-ink-700 mb-1.5"
                htmlFor="boardName"
              >
                First board
              </label>
              <input
                id="boardName"
                name="boardName"
                defaultValue={values?.boardName ?? "Video pipeline"}
                className="input w-full bg-base-100"
                required
              />
              <p className="mt-1.5 text-[12.5px] text-ink-400">
                Five columns, from idea to scheduled. Add more boards whenever you want.
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-1.5" htmlFor="niche">
                Who are the videos for?{" "}
                <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <input
                id="niche"
                name="niche"
                defaultValue={values?.niche}
                placeholder="e.g. indie game devs, personal finance, home fitness"
                className="input w-full bg-base-100"
              />
              <p className="mt-1.5 text-[12.5px] text-ink-400">
                The one thing the AI keeps in mind for every idea and script. Skip it now and set
                it in board settings later.
              </p>
            </div>
          </>
        )}

        <button className="btn btn-primary w-full gap-2" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {firstRun ? "Create it and open the board" : "Create workspace"}
          {!busy && firstRun && <ArrowRight className="size-4" />}
        </button>
      </Form>
    </main>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel back={{ to: "/app", label: "Back to your workspaces" }} />;
}

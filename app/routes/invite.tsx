import { Form, Link, data, redirect, useParams } from "react-router";
import { UserPlus } from "lucide-react";
import type { Route } from "./+types/invite";
import { db } from "~/lib/db.server";
import { getUser } from "~/lib/session.server";
import { Logo } from "~/components/ui";
import { RouteErrorPanel } from "~/components/route-error";

export const meta = () => [{ title: "Invitation · saas-marketer" }];

export async function loader({ request, params }: Route.LoaderArgs) {
  const invite = await db.invite.findUnique({
    where: { token: params.token! },
    include: { workspace: true, invitedBy: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt) throw data("This invitation no longer exists", { status: 404 });

  const user = await getUser(request);
  return {
    signedIn: Boolean(user),
    emailMatches: user?.email === invite.email,
    invite: {
      email: invite.email,
      workspaceName: invite.workspace.name,
      invitedBy: invite.invitedBy.name,
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await getUser(request);
  const invite = await db.invite.findUnique({ where: { token: params.token! } });
  if (!invite || invite.acceptedAt) throw data("This invitation no longer exists", { status: 404 });
  if (!user) throw redirect(`/signup?redirectTo=/invite/${params.token}`);

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: invite.workspaceId } });

  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
    create: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
    update: {},
  });
  await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

  return redirect(`/app/${workspace.slug}`);
}

export default function Invite({ loaderData }: Route.ComponentProps) {
  const { invite, signedIn, emailMatches } = loaderData;
  const { token } = useParams();

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Link to="/">
        <Logo />
      </Link>

      <div className="mt-10 w-full rounded-box border border-ink-200 bg-base-100 p-8">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <UserPlus className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-ink-900">
          You have been invited to {invite.workspaceName}
        </h1>
        <p className="mt-2 text-[14px] text-ink-500">
          {invite.invitedBy} invited {invite.email} to collaborate in this workspace.
        </p>

        {signedIn && !emailMatches && (
          <p className="mt-4 rounded-box border border-warning/30 bg-warning/8 px-3 py-2 text-[13px] text-ink-700">
            You are signed in with a different email. You can still join.
          </p>
        )}

        <Form method="post" className="mt-6">
          <button className="btn btn-primary w-full">
            {signedIn ? "Join workspace" : "Create account and join"}
          </button>
        </Form>

        {!signedIn && (
          <p className="mt-4 text-[13px] text-ink-500">
            Already have an account?{" "}
            <Link
              to={`/login?redirectTo=/invite/${token}`}
              className="text-brand-600 hover:text-brand-700"
            >
              Sign in first
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel back={{ to: "/", label: "Back to the front page" }} />;
}

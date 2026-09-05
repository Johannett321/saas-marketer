import { useState } from "react";
import { Form, data, useNavigation, useSubmit } from "react-router";
import { z } from "zod";
import { Check, Copy, Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Route } from "./+types/workspace-members";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireWorkspace } from "~/lib/workspace.server";
import { Avatar } from "~/components/ui";
import { useConfirm } from "~/components/confirm";
import { RouteErrorPanel } from "~/components/route-error";

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `Members · ${loaderData?.workspace.name ?? ""} · saas-marketer` },
];

export const handle = { breadcrumb: () => ({ label: "Members" }) };

const ROLE_LABEL = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" } as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { workspace, role } = await requireWorkspace(user.id, params.workspaceSlug!);

  const invites = await db.invite.findMany({
    where: { workspaceId: workspace.id, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return {
    me: user,
    myRole: role,
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    members: workspace.members.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  role: z.enum(["MEMBER", "ADMIN"]),
});

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { workspace } = await requireWorkspace(user.id, params.workspaceSlug!, "ADMIN");
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "invite") {
    const parsed = InviteSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return data({ error: z.flattenError(parsed.error).fieldErrors.email?.[0] ?? "Invalid" }, { status: 400 });
    }
    const { email, role } = parsed.data;

    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const already = await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: existingUser.id } },
      });
      if (already) return data({ error: "That person is already a member." }, { status: 400 });

      await db.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: existingUser.id, role },
      });
      return { ok: true, added: true };
    }

    await db.invite.upsert({
      where: { workspaceId_email: { workspaceId: workspace.id, email } },
      create: { workspaceId: workspace.id, email, role, invitedById: user.id },
      update: { role, acceptedAt: null },
    });
    return { ok: true, added: false };
  }

  if (intent === "revoke-invite") {
    await db.invite.deleteMany({
      where: { id: String(form.get("inviteId")), workspaceId: workspace.id },
    });
    return { ok: true };
  }

  if (intent === "remove-member") {
    const memberId = String(form.get("memberId"));
    const member = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: workspace.id },
    });
    if (!member) return data({ error: "Member not found" }, { status: 404 });
    if (member.role === "OWNER") {
      return data({ error: "You cannot remove the workspace owner." }, { status: 400 });
    }
    await db.workspaceMember.delete({ where: { id: memberId } });
    return { ok: true };
  }

  throw data("Unknown intent", { status: 400 });
}

export default function Members({ loaderData, actionData }: Route.ComponentProps) {
  const { members, invites, me, myRole, workspace } = loaderData;
  const nav = useNavigation();
  const submit = useSubmit();
  const { confirm, dialog } = useConfirm();
  const canManage = myRole === "OWNER" || myRole === "ADMIN";
  const busy = nav.state !== "idle";
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Members</h1>
        <p className="mt-1 text-ink-500">
          Everyone in {workspace.name} can see every project in the workspace.
        </p>

        {canManage && (
          <section className="mt-8 rounded-box border border-ink-200 bg-base-100 p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wider text-ink-500 uppercase">
              <UserPlus className="size-3.5" /> Invite someone
            </h2>
            <Form method="post" className="mt-3 flex flex-wrap gap-2" replace>
              <input type="hidden" name="intent" value="invite" />
              <input
                name="email"
                type="email"
                placeholder="name@company.com"
                className="input min-w-[14rem] flex-1 bg-base-100"
                required
              />
              <select name="role" className="select border-ink-200 bg-base-100" defaultValue="MEMBER">
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button className="btn btn-primary gap-1.5" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                Invite
              </button>
            </Form>
            {error && <p className="mt-2 text-[13px] text-error">{error}</p>}
            <p className="mt-2 text-[12.5px] text-ink-400">
              If they already have an account they are added right away. Otherwise you get an
              invite link to send them.
            </p>
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-box border border-ink-200 bg-base-100">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 border-b border-ink-150 px-5 py-3.5 last:border-0"
            >
              <Avatar user={m.user} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink-900">
                  {m.user.name}
                  {m.user.id === me.id && <span className="text-ink-400"> (deg)</span>}
                </p>
                <p className="truncate text-[12.5px] text-ink-500">{m.user.email}</p>
              </div>
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11.5px] font-medium text-ink-600">
                {ROLE_LABEL[m.role]}
              </span>
              {canManage && m.role !== "OWNER" && m.user.id !== me.id && (
                <Form
                  method="post"
                  replace
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const ok = await confirm({
                      title: `Remove ${m.user.name}?`,
                      description: "They lose access to every project in this workspace.",
                      confirmLabel: "Remove",
                      danger: true,
                    });
                    if (ok) submit(form);
                  }}
                >
                  <input type="hidden" name="intent" value="remove-member" />
                  <input type="hidden" name="memberId" value={m.id} />
                  <button
                    className="btn btn-ghost btn-xs btn-square text-ink-400 hover:text-error"
                    aria-label={`Remove ${m.user.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </Form>
              )}
            </div>
          ))}
        </section>

        {invites.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[13px] font-semibold tracking-wider text-ink-500 uppercase">
              Pending invites
            </h2>
            <div className="mt-3 space-y-2">
              {invites.map((i) => (
                <InviteRow key={i.id} invite={i} canManage={canManage} />
              ))}
            </div>
          </section>
        )}

        {dialog}
      </div>
    </main>
  );
}

function InviteRow({
  invite,
  canManage,
}: {
  invite: { id: string; email: string; role: string; token: string; createdAt: string };
  canManage: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window === "undefined" ? "" : `${window.location.origin}/invite/${invite.token}`;

  return (
    <div className="flex items-center gap-3 rounded-box border border-dashed border-ink-300 px-4 py-3">
      <span className="grid size-8 place-items-center rounded-full bg-ink-100 text-ink-400">
        <Mail className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-ink-800">{invite.email}</p>
        <p className="text-[12px] text-ink-400">
          Invited{" "}
          {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true })}
        </p>
      </div>
      <button
        className="btn btn-outline btn-xs gap-1.5"
        onClick={() => {
          navigator.clipboard?.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      {canManage && (
        <Form method="post" replace>
          <input type="hidden" name="intent" value="revoke-invite" />
          <input type="hidden" name="inviteId" value={invite.id} />
          <button
            className="btn btn-ghost btn-xs btn-square text-ink-400 hover:text-error"
            aria-label="Revoke"
          >
            <Trash2 className="size-3.5" />
          </button>
        </Form>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel compact />;
}

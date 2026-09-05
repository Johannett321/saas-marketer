import { Form, Link, data, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import type { Route } from "./+types/signup";
import { db } from "~/lib/db.server";
import { hashPassword } from "~/lib/auth.server";
import { createUserSession, getUser } from "~/lib/session.server";
import { FieldError, Logo } from "~/components/ui";
import { AuthAside } from "~/components/auth-aside";

export const meta = () => [{ title: "Create account · saas-marketer" }];

const Schema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "At least 8 characters"),
});

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) throw redirect("/app");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = Object.fromEntries(await request.formData());
  const parsed = Schema.safeParse(form);
  if (!parsed.success) {
    return data(
      { errors: z.flattenError(parsed.error).fieldErrors, values: form },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return data(
      { errors: { email: ["An account with that email already exists"] }, values: form },
      { status: 400 },
    );
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      avatarHue: Math.floor(Math.random() * 360),
    },
  });

  // Auto-accept any workspace invite waiting for this address.
  const invites = await db.invite.findMany({ where: { email, acceptedAt: null } });
  for (const invite of invites) {
    await db.workspaceMember.create({
      data: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
    });
    await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  }

  const redirectTo = String(form.redirectTo || "/app");
  return createUserSession(user.id, redirectTo.startsWith("/") ? redirectTo : "/app");
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const errors = actionData?.errors as Record<string, string[] | undefined> | undefined;
  const values = actionData?.values as Record<string, string> | undefined;

  return (
    <div className="relative z-10 grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/">
            <Logo />
          </Link>
          <h1 className="mt-10 text-3xl font-semibold tracking-tight text-ink-900">Create your account</h1>
          <p className="mt-2 text-ink-500">Set up your workspace in under a minute.</p>

          <Form method="post" className="mt-8 space-y-4" replace>
            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-1.5" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                defaultValue={values?.name}
                placeholder="Jane Doe"
                className="input w-full bg-base-100"
                required
              />
              <FieldError>{errors?.name?.[0]}</FieldError>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={values?.email}
                placeholder="you@company.com"
                className="input w-full bg-base-100"
                required
              />
              <FieldError>{errors?.email?.[0]}</FieldError>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="input w-full bg-base-100"
                required
              />
              <FieldError>{errors?.password?.[0]}</FieldError>
            </div>

            <button className="btn btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Create account
            </button>
          </Form>

          <p className="mt-6 text-sm text-ink-500">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <AuthAside />
    </div>
  );
}

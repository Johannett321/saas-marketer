import { Form, Link, data, redirect, useNavigation, useSearchParams } from "react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import type { Route } from "./+types/login";
import { db } from "~/lib/db.server";
import { verifyPassword } from "~/lib/auth.server";
import { createUserSession, getUser } from "~/lib/session.server";
import { FieldError, Logo } from "~/components/ui";
import { AuthAside } from "~/components/auth-aside";

export const meta = () => [{ title: "Sign in · saas-marketer" }];

const Schema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) throw redirect("/app");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = Object.fromEntries(await request.formData());
  const parsed = Schema.safeParse(form);
  if (!parsed.success) {
    return data({ errors: z.flattenError(parsed.error).fieldErrors, values: form }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !ok) {
    return data(
      { errors: { email: ["Wrong email or password"] }, values: form },
      { status: 400 },
    );
  }

  const redirectTo = String(form.redirectTo || "/app");
  return createUserSession(user.id, redirectTo.startsWith("/") ? redirectTo : "/app");
}

export default function Login({ actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  const [params] = useSearchParams();
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
          <h1 className="mt-10 text-3xl font-semibold tracking-tight text-ink-900">Welcome back</h1>
          <p className="mt-2 text-ink-500">Sign in to get back to your board.</p>

          <Form method="post" className="mt-8 space-y-4" replace>
            <input type="hidden" name="redirectTo" value={params.get("redirectTo") ?? "/app"} />
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
                autoComplete="current-password"
                className="input w-full bg-base-100"
                required
              />
              <FieldError>{errors?.password?.[0]}</FieldError>
            </div>

            <button className="btn btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </button>
          </Form>

          <p className="mt-6 text-sm text-ink-500">
            New here?{" "}
            <Link to="/signup" className="text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      <AuthAside />
    </div>
  );
}

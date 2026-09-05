import { createCookieSessionStorage, redirect } from "react-router";
import { db } from "./db.server";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET is not set.");

const storage = createCookieSessionStorage({
  cookie: {
    name: "__saas_marketer_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  },
});

export function getSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await storage.commitSession(session) },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await storage.destroySession(session) },
  });
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request);
  const userId = session.get("userId");
  return typeof userId === "string" ? userId : null;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatarHue: true, avatarUpdatedAt: true },
  });
  return user;
}

/**
 * Redirects to /login (preserving the destination) when signed out.
 * A cookie pointing at a user that no longer exists is destroyed on the way out,
 * otherwise /login would bounce it straight back and loop.
 */
export async function requireUser(request: Request) {
  const user = await getUser(request);
  if (user) return user;

  const url = new URL(request.url);
  const params = new URLSearchParams({ redirectTo: url.pathname + url.search });
  const session = await getSession(request);
  throw redirect(`/login?${params}`, {
    headers: { "Set-Cookie": await storage.destroySession(session) },
  });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

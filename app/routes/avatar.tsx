import { data } from "react-router";
import type { Route } from "./+types/avatar";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";

/**
 * Serves an uploaded profile picture. Only signed-in users can read them, and
 * only for people they actually share a workspace with.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const viewer = await requireUser(request);
  const userId = params.userId!;

  if (userId !== viewer.id) {
    const shared = await db.workspaceMember.findFirst({
      where: {
        userId,
        workspace: { members: { some: { userId: viewer.id } } },
      },
      select: { id: true },
    });
    if (!shared) throw data("Not found", { status: 404 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { avatarData: true, avatarType: true, avatarUpdatedAt: true },
  });

  if (!user?.avatarData || !user.avatarUpdatedAt) throw data("Not found", { status: 404 });

  const etag = `"${user.avatarUpdatedAt.getTime()}"`;
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(user.avatarData), {
    headers: {
      "Content-Type": user.avatarType ?? "image/png",
      "Content-Length": String(user.avatarData.byteLength),
      ETag: etag,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

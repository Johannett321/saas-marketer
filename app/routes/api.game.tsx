import { data } from "react-router";
import type { Route } from "./+types/api.game";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireWorkspace } from "~/lib/workspace.server";

export type GameBests = {
  personalBest: number;
  workspaceBest: number;
  workspaceBestBy: string | null;
};

async function bests(workspaceId: string, userId: string): Promise<GameBests> {
  const [mine, top] = await Promise.all([
    db.gameScore.aggregate({
      where: { workspaceId, userId },
      _max: { score: true },
    }),
    db.gameScore.findFirst({
      where: { workspaceId },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      select: { score: true, user: { select: { name: true } } },
    }),
  ]);

  return {
    personalBest: mine._max.score ?? 0,
    workspaceBest: top?.score ?? 0,
    workspaceBestBy: top?.user.name ?? null,
  };
}

/** GET ?workspace=slug — current bests for the panel. */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const slug = new URL(request.url).searchParams.get("workspace");
  if (!slug) throw data("Missing workspace", { status: 400 });

  const { workspace } = await requireWorkspace(user.id, slug);
  return bests(workspace.id, user.id);
}

/** POST { workspace, score } — records a run and returns the updated bests. */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const slug = String(form.get("workspace") ?? "");
  const score = Math.floor(Number(form.get("score")));

  const { workspace } = await requireWorkspace(user.id, slug);

  if (!Number.isFinite(score) || score <= 0 || score > 10_000) {
    return bests(workspace.id, user.id);
  }

  await db.gameScore.create({
    data: { workspaceId: workspace.id, userId: user.id, score },
  });

  return bests(workspace.id, user.id);
}

import { data } from "react-router";
import type { Route } from "./+types/api.ideas";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireProjectById } from "~/lib/workspace.server";
import { generateIdeas, type GenerationMode } from "~/lib/ai.server";
import { loadAiCredentials } from "~/lib/ai-credentials.server";
import { MISSING_KEY_MESSAGE } from "~/lib/ai";
import { nextPosition } from "~/lib/cards.server";
import { recordActivity } from "~/lib/activity.server";
import type { CardSource } from "~/generated/prisma/enums";

export async function loader() {
  throw data("Not found", { status: 404 });
}

const SOURCE_FOR_MODE: Record<GenerationMode, CardSource> = {
  URL: "URL",
  NEWS: "NEWS",
  RANDOM: "RANDOM",
};

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "generate");

  if (intent === "generate") {
    const projectId = String(form.get("projectId") ?? "");
    const mode = String(form.get("mode") ?? "RANDOM") as GenerationMode;
    const count = Math.min(Math.max(Number(form.get("count") ?? 5) || 5, 1), 10);
    const url = String(form.get("url") ?? "").trim();

    const { project } = await requireProjectById(user.id, projectId);

    const credentials = await loadAiCredentials(user.id);
    if (!credentials) {
      return data({ error: MISSING_KEY_MESSAGE }, { status: 400 });
    }
    if (mode === "URL" && !/^https?:\/\//i.test(url)) {
      return data({ error: "Paste a valid link (it must start with http or https)." }, { status: 400 });
    }

    const existing = await db.videoCard.findMany({
      where: { projectId: project.id },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    try {
      const result = await generateIdeas(credentials, {
        mode,
        count,
        url: mode === "URL" ? url : undefined,
        project: { name: project.name, niche: project.niche, description: project.description },
        existingTitles: existing.map((c) => c.title),
      });

      const batch = await db.ideaBatch.create({
        data: {
          projectId: project.id,
          userId: user.id,
          mode,
          sourceUrl: mode === "URL" ? url : null,
          suggestions: {
            create: result.suggestions.map((s) => ({
              title: s.title,
              angle: s.angle,
              rationale: s.rationale,
              sourceUrl: s.sourceUrl ?? result.source?.url ?? null,
              sourceTitle: s.sourceTitle ?? result.source?.title ?? null,
              sourceExcerpt: result.source?.excerpt ?? null,
            })),
          },
        },
        include: { suggestions: { orderBy: { createdAt: "asc" } } },
      });

      return {
        batchId: batch.id,
        source: result.source ? { url: result.source.url, title: result.source.title } : null,
        suggestions: batch.suggestions.map((s) => ({
          id: s.id,
          title: s.title,
          angle: s.angle,
          rationale: s.rationale,
          sourceUrl: s.sourceUrl,
          sourceTitle: s.sourceTitle,
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return data({ error: message }, { status: 502 });
    }
  }

  if (intent === "accept") {
    const suggestionId = String(form.get("suggestionId") ?? "");
    const suggestion = await db.ideaSuggestion.findUnique({
      where: { id: suggestionId },
      include: { batch: true },
    });
    if (!suggestion) throw data("Suggestion not found", { status: 404 });

    const { project, workspace } = await requireProjectById(user.id, suggestion.batch.projectId);

    const card = await db.videoCard.create({
      data: {
        projectId: project.id,
        title: suggestion.title,
        angle: suggestion.angle || null,
        status: "IDEA",
        position: await nextPosition(project.id, "IDEA"),
        createdById: user.id,
        source: SOURCE_FOR_MODE[suggestion.batch.mode],
        sourceUrl: suggestion.sourceUrl,
        sourceTitle: suggestion.sourceTitle,
        sourceExcerpt: suggestion.sourceExcerpt,
      },
    });

    await db.statusEvent.create({ data: { cardId: card.id, toStatus: "IDEA", userId: user.id } });
    await db.ideaSuggestion.update({
      where: { id: suggestion.id },
      data: { usedCardId: card.id },
    });

    await recordActivity({
      type: "CREATED",
      card,
      workspace,
      projectSlug: project.slug,
      actor: user,
    });

    return { cardId: card.id };
  }

  throw data("Unknown intent", { status: 400 });
}

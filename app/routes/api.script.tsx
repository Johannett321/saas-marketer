import { data } from "react-router";
import type { Route } from "./+types/api.script";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { requireCard } from "~/lib/workspace.server";
import { fetchArticle, generateScript, improveScript } from "~/lib/ai.server";
import { loadAiCredentials } from "~/lib/ai-credentials.server";
import { MISSING_KEY_MESSAGE } from "~/lib/ai";
import { recordActivity } from "~/lib/activity.server";
import type { ActivityType, RevisionSource } from "~/generated/prisma/enums";

export async function loader() {
  throw data("Not found", { status: 404 });
}

async function saveRevision(cardId: string, content: string, source: RevisionSource, userId: string) {
  await db.$transaction([
    db.videoCard.update({
      where: { id: cardId },
      data: { script: content, scriptUpdatedAt: new Date() },
    }),
    db.scriptRevision.create({ data: { cardId, content, source, createdById: userId } }),
  ]);
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const cardId = String(form.get("cardId") ?? "");

  const { card } = await requireCard(user.id, cardId);
  const project = card.project;
  const projectContext = {
    name: project.name,
    niche: project.niche,
    description: project.description,
  };

  const announce = (type: ActivityType) =>
    recordActivity({
      type,
      card: { id: card.id, title: card.title },
      workspace: project.workspace,
      projectSlug: project.slug,
      actor: user,
    });

  if (intent === "save") {
    const content = String(form.get("script") ?? "");
    await saveRevision(card.id, content, "MANUAL", user.id);
    await announce("SCRIPT_EDITED");
    return { ok: true, script: content };
  }

  const credentials = await loadAiCredentials(user.id);
  if (!credentials) {
    return data({ error: MISSING_KEY_MESSAGE }, { status: 400 });
  }

  try {
    if (intent === "generate") {
      // The regenerate dialog lets people fix the context first; persist it here so
      // the generation below reads the values the user just approved.
      const rawDescription = form.get("description");
      const rawAngle = form.get("angle");

      if (rawDescription !== null || rawAngle !== null) {
        const nextDescription =
          rawDescription === null ? card.description : String(rawDescription).trim() || null;
        const nextAngle = rawAngle === null ? card.angle : String(rawAngle).trim() || null;

        const descriptionChanged = nextDescription !== card.description;
        const angleChanged = nextAngle !== card.angle;

        if (descriptionChanged || angleChanged) {
          await db.videoCard.update({
            where: { id: card.id },
            data: { description: nextDescription, angle: nextAngle },
          });
          card.description = nextDescription;
          card.angle = nextAngle;

          if (descriptionChanged) await announce("DESCRIPTION_CHANGED");
          if (angleChanged) await announce("ANGLE_CHANGED");
        }
      }

      // If the card came from a link but we never stored the article body, fetch it now.
      let excerpt = card.sourceExcerpt;
      if (!excerpt && card.sourceUrl) {
        try {
          excerpt = (await fetchArticle(card.sourceUrl)).excerpt;
          await db.videoCard.update({ where: { id: card.id }, data: { sourceExcerpt: excerpt } });
        } catch {
          excerpt = null; // fall back to plain web research
        }
      }

      const { content, sources } = await generateScript(credentials, {
        title: card.title,
        angle: card.angle,
        project: projectContext,
        sourceUrl: card.sourceUrl,
        sourceTitle: card.sourceTitle,
        sourceExcerpt: excerpt,
      });

      await saveRevision(card.id, content, "AI_GENERATED", user.id);
      await announce("SCRIPT_GENERATED");
      return { ok: true, script: content, sources };
    }

    if (intent === "improve") {
      if (!card.script?.trim()) {
        return data({ error: "There is no script to improve yet." }, { status: 400 });
      }
      const { content } = await improveScript(credentials, {
        title: card.title,
        script: card.script,
        project: projectContext,
        instruction: String(form.get("instruction") ?? ""),
      });

      await saveRevision(card.id, content, "AI_IMPROVED", user.id);
      await announce("SCRIPT_IMPROVED");
      return { ok: true, script: content };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return data({ error: message }, { status: 502 });
  }

  throw data("Unknown intent", { status: 400 });
}

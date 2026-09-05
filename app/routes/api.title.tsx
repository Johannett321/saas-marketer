import { data } from "react-router";
import type { Route } from "./+types/api.title";
import { requireUser } from "~/lib/session.server";
import { requireCard } from "~/lib/workspace.server";
import { improveTitle } from "~/lib/ai.server";
import { loadAiCredentials } from "~/lib/ai-credentials.server";
import { MISSING_KEY_MESSAGE } from "~/lib/ai";

export async function loader() {
  throw data("Not found", { status: 404 });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const { card } = await requireCard(user.id, String(form.get("cardId") ?? ""));

  const credentials = await loadAiCredentials(user.id);
  if (!credentials) {
    return data({ error: MISSING_KEY_MESSAGE }, { status: 400 });
  }

  try {
    const options = await improveTitle(credentials, {
      title: card.title,
      description: card.description,
      angle: card.angle,
      project: {
        name: card.project.name,
        niche: card.project.niche,
        description: card.project.description,
      },
    });
    return { options };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return data({ error: message }, { status: 502 });
  }
}

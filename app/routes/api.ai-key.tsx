import { data } from "react-router";
import type { Route } from "./+types/api.ai-key";
import { requireUser } from "~/lib/session.server";
import { saveApiKey } from "~/lib/ai-credentials.server";
import { looksLikeApiKey } from "~/lib/ai";

/**
 * Saving the key from wherever the person hit the wall, instead of sending them
 * to the profile page and expecting them to find their way back. The key is
 * written by the same encrypted path the profile form uses and never comes back
 * out — the response only says it worked.
 */
export async function loader() {
  throw data("Not found", { status: 404 });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "save") {
    const key = String(form.get("apiKey") ?? "").trim();
    if (!looksLikeApiKey(key)) {
      return data(
        { error: 'That does not look like an OpenAI API key. They start with "sk-".' },
        { status: 400 },
      );
    }

    await saveApiKey(user.id, key);
    return { ok: true };
  }

  throw data("Unknown intent", { status: 400 });
}

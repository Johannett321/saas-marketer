import { data } from "react-router";
import type { Route } from "./+types/api.project-profile";
import { requireUser } from "~/lib/session.server";
import { requireProjectById } from "~/lib/workspace.server";
import { profileProjectFromSite } from "~/lib/ai.server";
import { loadAiCredentials } from "~/lib/ai-credentials.server";
import { MISSING_KEY_MESSAGE } from "~/lib/ai";

export async function loader() {
  throw data("Not found", { status: 404 });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const projectId = String(form.get("projectId") ?? "");
  const url = String(form.get("url") ?? "").trim();

  // membership check — profiling spends the caller’s own API credit
  await requireProjectById(user.id, projectId);

  const credentials = await loadAiCredentials(user.id);
  if (!credentials) {
    return data({ error: MISSING_KEY_MESSAGE }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return data({ error: "Paste a valid link (it must start with http or https)." }, { status: 400 });
  }

  try {
    const profile = await profileProjectFromSite(credentials, url);
    return { profile };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return data({ error: message }, { status: 502 });
  }
}

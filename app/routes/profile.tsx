import { useEffect, useRef, useState } from "react";
import { Form, data, useFetcher, useNavigation } from "react-router";
import { z } from "zod";
import { Camera, KeyRound, Loader2, Trash2 } from "lucide-react";
import type { Route } from "./+types/profile";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { hashPassword, verifyPassword } from "~/lib/auth.server";
import { Avatar } from "~/components/ui";
import { RouteErrorPanel } from "~/components/route-error";
import { useConfirm } from "~/components/confirm";
import {
  clearApiKey,
  loadAiSettings,
  saveApiKey,
  saveModelPreferences,
} from "~/lib/ai-credentials.server";
import {
  DEFAULT_AI_MODEL,
  REASONING_EFFORTS,
  SUGGESTED_AI_MODELS,
  looksLikeApiKey,
} from "~/lib/ai";

export const meta = () => [{ title: "Your profile · saas-marketer" }];
export const handle = { breadcrumb: () => ({ label: "Profile" }) };

const MAX_AVATAR_BYTES = 1_500_000;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireUser(request);
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      avatarHue: true,
      avatarUpdatedAt: true,
      createdAt: true,
    },
  });
  return { user, ai: await loadAiSettings(session.id) };
}

const ProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

export async function action({ request }: Route.ActionArgs) {
  const session = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "profile") {
    const parsed = ProfileSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      return data({ error: errors.name?.[0] ?? errors.email?.[0] ?? "Invalid" }, { status: 400 });
    }

    const taken = await db.user.findFirst({
      where: { email: parsed.data.email, id: { not: session.id } },
      select: { id: true },
    });
    if (taken) return data({ error: "That email is already in use." }, { status: 400 });

    await db.user.update({ where: { id: session.id }, data: parsed.data });
    return { ok: "Profile saved" };
  }

  if (intent === "password") {
    const current = String(form.get("currentPassword") ?? "");
    const next = String(form.get("newPassword") ?? "");
    if (next.length < 8) {
      return data({ error: "The new password must be at least 8 characters." }, { status: 400 });
    }

    const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
    if (!(await verifyPassword(current, user.passwordHash))) {
      return data({ error: "That is not your current password." }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.id },
      data: { passwordHash: await hashPassword(next) },
    });
    return { ok: "Password changed" };
  }

  if (intent === "ai") {
    const key = String(form.get("apiKey") ?? "").trim();

    // A blank field means "leave the stored key alone" — the input is never
    // pre-filled with the real key, so blank cannot mean "clear it".
    if (key) {
      if (!looksLikeApiKey(key)) {
        return data(
          { error: "That does not look like an OpenAI API key. They start with \"sk-\"." },
          { status: 400 },
        );
      }
      await saveApiKey(session.id, key);
    }

    await saveModelPreferences(session.id, {
      model: String(form.get("model") ?? ""),
      reasoningEffort: String(form.get("reasoningEffort") ?? ""),
    });

    return { ok: key ? "API key saved" : "AI settings saved" };
  }

  if (intent === "ai-remove") {
    await clearApiKey(session.id);
    return { ok: "API key removed" };
  }

  if (intent === "avatar") {
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
      return data({ error: "Pick an image first." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return data({ error: "Use a PNG, JPEG or WebP image." }, { status: 400 });
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return data({ error: "That image is too large." }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.id },
      data: {
        avatarData: Buffer.from(await file.arrayBuffer()),
        avatarType: file.type,
        avatarUpdatedAt: new Date(),
      },
    });
    return { ok: "Picture updated" };
  }

  if (intent === "remove-avatar") {
    await db.user.update({
      where: { id: session.id },
      data: { avatarData: null, avatarType: null, avatarUpdatedAt: null },
    });
    return { ok: "Picture removed" };
  }

  throw data("Unknown intent", { status: 400 });
}

/** Downscales to a square before upload so the database only ever holds thumbnails. */
async function toSquareThumbnail(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image."))),
      "image/webp",
      0.9,
    ),
  );
}

export default function Profile({ loaderData, actionData }: Route.ComponentProps) {
  const { user, ai } = loaderData;
  const nav = useNavigation();
  const avatar = useFetcher<{ ok?: string; error?: string }>();
  const removeKey = useFetcher<{ ok?: string; error?: string }>();
  const { confirm, dialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = nav.state !== "idle";
  const uploading = avatar.state !== "idle";
  const message =
    (actionData && "ok" in actionData ? actionData.ok : null) ??
    avatar.data?.ok ??
    removeKey.data?.ok;
  const error =
    localError ??
    (actionData && "error" in actionData ? actionData.error : null) ??
    avatar.data?.error ??
    removeKey.data?.error;

  useEffect(() => {
    if (avatar.state === "idle") setLocalError(null);
  }, [avatar.state]);

  const pick = async (file: File) => {
    setLocalError(null);
    try {
      const thumb = await toSquareThumbnail(file);
      const body = new FormData();
      body.set("intent", "avatar");
      body.set("avatar", new File([thumb], "avatar.webp", { type: "image/webp" }));
      avatar.submit(body, { method: "post", encType: "multipart/form-data" });
    } catch {
      setLocalError("Could not read that image. Try another file.");
    }
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Your profile</h1>
        <p className="mt-1 text-ink-500">
          This is how you appear to everyone in your workspaces.
        </p>

        {(message || error) && (
          <p
            className={`mt-4 rounded-box px-4 py-2.5 text-[13px] ${
              error ? "bg-error/8 text-error" : "bg-success/10 text-success"
            }`}
          >
            {error ?? message}
          </p>
        )}

        {/* ---------------------------------------------------------- picture */}
        <section className="mt-6 flex flex-wrap items-center gap-5 rounded-box border border-ink-200 bg-base-100 p-6">
          <div className="relative">
            <Avatar user={user} size={72} />
            {uploading && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-base-100/70">
                <Loader2 className="size-5 animate-spin text-brand-600" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink-800">Profile picture</p>
            <p className="mt-0.5 text-[12.5px] text-ink-500">
              PNG, JPEG or WebP. Cropped to a square and scaled down to 256px before upload.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn btn-outline btn-sm gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="size-3.5" /> {user.avatarUpdatedAt ? "Replace" : "Upload"}
              </button>

              {user.avatarUpdatedAt && (
                <avatar.Form
                  method="post"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const ok = await confirm({
                      title: "Remove your picture?",
                      description: "You will go back to your initials.",
                      confirmLabel: "Remove",
                      danger: true,
                    });
                    if (ok) avatar.submit(form);
                  }}
                >
                  <input type="hidden" name="intent" value="remove-avatar" />
                  <button className="btn btn-ghost btn-sm gap-1.5 text-ink-500 hover:text-error">
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </avatar.Form>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void pick(file);
              }}
            />
          </div>
        </section>

        {/* ---------------------------------------------------------- details */}
        <Form method="post" className="mt-4 space-y-4 rounded-box border border-ink-200 bg-base-100 p-6">
          <input type="hidden" name="intent" value="profile" />
          <h2 className="text-[12px] font-semibold tracking-wider text-ink-400 uppercase">
            Details
          </h2>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={user.name}
              className="input w-full bg-base-100"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email}
              className="input w-full bg-base-100"
              required
            />
          </div>

          <button className="btn btn-primary" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </button>
        </Form>

        {/* ---------------------------------------------------------- AI provider */}
        <Form method="post" className="mt-4 space-y-4 rounded-box border border-ink-200 bg-base-100 p-6">
          <input type="hidden" name="intent" value="ai" />

          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-box bg-brand-50 text-brand-600">
              <KeyRound className="size-4" />
            </span>
            <div>
              <h2 className="text-[12px] font-semibold tracking-wider text-ink-400 uppercase">
                AI provider
              </h2>
              <p className="mt-1 text-[12.5px] text-ink-500">
                Idea generation, script writing and web research run on{" "}
                <span className="font-medium text-ink-700">your own</span> OpenAI key. It is
                encrypted before it is stored and is never sent to the browser. Nobody else in your
                workspace can use it, and usage is billed to your OpenAI account.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="apiKey">
              OpenAI API key
            </label>
            <input
              id="apiKey"
              name="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={ai.hasKey ? `Key ending in ····${ai.keyHint} is saved` : "sk-..."}
              className="input w-full bg-base-100 font-mono text-[13px]"
            />
            <p className="mt-1.5 text-[12.5px] text-ink-500">
              {ai.hasKey ? (
                <>
                  Saved{" "}
                  {ai.keySetAt
                    ? new Date(ai.keySetAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "earlier"}
                  . Leave this blank to keep it, or paste a new key to replace it.
                </>
              ) : (
                <>
                  Create one at{" "}
                  <a
                    className="link text-brand-600"
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    platform.openai.com/api-keys
                  </a>
                  . Without a key the app works fine — the AI buttons just tell you it is missing.
                </>
              )}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="model">
                Model
              </label>
              <input
                id="model"
                name="model"
                list="ai-model-suggestions"
                defaultValue={ai.model}
                placeholder={DEFAULT_AI_MODEL}
                spellCheck={false}
                className="input w-full bg-base-100 font-mono text-[13px]"
              />
              <datalist id="ai-model-suggestions">
                {SUGGESTED_AI_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <p className="mt-1.5 text-[12.5px] text-ink-500">
                Any model your key can reach, as long as it supports the Responses API.
              </p>
            </div>

            <div>
              <label
                className="mb-1.5 block text-[13px] font-medium text-ink-700"
                htmlFor="reasoningEffort"
              >
                Reasoning effort
              </label>
              <select
                id="reasoningEffort"
                name="reasoningEffort"
                defaultValue={ai.reasoningEffort}
                className="select w-full bg-base-100"
              >
                {REASONING_EFFORTS.map((effort) => (
                  <option key={effort} value={effort}>
                    {effort}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[12.5px] text-ink-500">
                Higher thinks longer and costs more. Drop to <code>low</code> if you are just
                trying things out.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save AI settings
            </button>
          </div>
        </Form>

        {ai.hasKey && (
          <removeKey.Form
            method="post"
            className="mt-2 flex justify-end"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const ok = await confirm({
                title: "Remove your API key?",
                description:
                  "The AI features stop working for you until you add a key again. Nothing else on your account changes.",
                confirmLabel: "Remove key",
                danger: true,
              });
              if (ok) removeKey.submit(form);
            }}
          >
            <input type="hidden" name="intent" value="ai-remove" />
            <button className="btn btn-ghost btn-sm gap-1.5 text-ink-500 hover:text-error">
              <Trash2 className="size-3.5" /> Remove stored key
            </button>
          </removeKey.Form>
        )}

        {/* ---------------------------------------------------------- password */}
        <Form method="post" className="mt-4 space-y-4 rounded-box border border-ink-200 bg-base-100 p-6">
          <input type="hidden" name="intent" value="password" />
          <h2 className="text-[12px] font-semibold tracking-wider text-ink-400 uppercase">
            Password
          </h2>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="currentPassword">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="input w-full bg-base-100"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700" htmlFor="newPassword">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="input w-full bg-base-100"
              required
            />
          </div>

          <button className="btn btn-outline" disabled={busy}>
            Change password
          </button>
        </Form>
      </div>

      {dialog}
    </main>
  );
}

export function ErrorBoundary() {
  return <RouteErrorPanel back={{ to: "/app", label: "Back to your workspaces" }} />;
}

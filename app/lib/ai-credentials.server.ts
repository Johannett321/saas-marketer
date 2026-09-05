import { db } from "./db.server";
import { decryptSecret, encryptSecret } from "./secrets.server";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_REASONING_EFFORT,
  REASONING_EFFORTS,
  type ReasoningEffort,
} from "./ai";

/**
 * Everything `ai.server.ts` needs to make a call. Assembled per request from the
 * signed-in user's profile — there is deliberately no instance-wide API key, so a
 * self-hosted instance never spends someone else's credit.
 */
export type AiCredentials = {
  apiKey: string;
  model: string;
  reasoningEffort: ReasoningEffort;
};

/** What the profile page is allowed to see: enough to describe the key, never the key. */
export type AiSettings = {
  hasKey: boolean;
  keyHint: string | null;
  keySetAt: Date | null;
  model: string;
  reasoningEffort: ReasoningEffort;
};

function toEffort(value: string | null): ReasoningEffort {
  return REASONING_EFFORTS.includes(value as ReasoningEffort)
    ? (value as ReasoningEffort)
    : DEFAULT_REASONING_EFFORT;
}

/**
 * Returns null when the user has no usable key — either they never set one, or
 * `SESSION_SECRET` was rotated and the stored ciphertext can no longer be read.
 * Callers turn null into `MISSING_KEY_MESSAGE`; nothing throws.
 */
export async function loadAiCredentials(userId: string): Promise<AiCredentials | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { aiApiKey: true, aiModel: true, aiReasoningEffort: true },
  });
  if (!user) return null;

  const apiKey = decryptSecret(user.aiApiKey);
  if (!apiKey) return null;

  return {
    apiKey,
    model: user.aiModel?.trim() || DEFAULT_AI_MODEL,
    reasoningEffort: toEffort(user.aiReasoningEffort),
  };
}

/** The safe projection for the profile loader. */
export async function loadAiSettings(userId: string): Promise<AiSettings> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { aiApiKey: true, aiKeyHint: true, aiKeySetAt: true, aiModel: true, aiReasoningEffort: true },
  });

  return {
    hasKey: Boolean(user?.aiApiKey),
    keyHint: user?.aiKeyHint ?? null,
    keySetAt: user?.aiKeySetAt ?? null,
    model: user?.aiModel?.trim() || DEFAULT_AI_MODEL,
    reasoningEffort: toEffort(user?.aiReasoningEffort ?? null),
  };
}

export async function saveApiKey(userId: string, plaintext: string) {
  const key = plaintext.trim();
  await db.user.update({
    where: { id: userId },
    data: {
      aiApiKey: encryptSecret(key),
      aiKeyHint: key.slice(-4),
      aiKeySetAt: new Date(),
    },
  });
}

export async function clearApiKey(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { aiApiKey: null, aiKeyHint: null, aiKeySetAt: null },
  });
}

export async function saveModelPreferences(
  userId: string,
  opts: { model: string; reasoningEffort: string },
) {
  await db.user.update({
    where: { id: userId },
    data: {
      aiModel: opts.model.trim() || null,
      aiReasoningEffort: toEffort(opts.reasoningEffort),
    },
  });
}

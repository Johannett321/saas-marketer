/**
 * Shared AI constants. This file has no `.server` suffix on purpose: the profile
 * form needs the same defaults and labels the server validates against.
 */

/** Used when a person has not chosen a model of their own. */
export const DEFAULT_AI_MODEL = "gpt-5.5";

/** Suggestions offered in the model field. Any model the user's key can reach works. */
export const SUGGESTED_AI_MODELS = ["gpt-5.5", "gpt-5.1", "gpt-5-mini"] as const;

export const REASONING_EFFORTS = ["minimal", "low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "high";

/**
 * Shown by every AI route when the signed-in user has no key. Routes return it as a
 * plain string so the existing error banners can render it unchanged.
 */
export const MISSING_KEY_MESSAGE =
  "No OpenAI API key on your profile yet. Add one under Profile → AI provider to use this.";

/** OpenAI keys start with `sk-`. Loose on purpose — the shape has changed before. */
export function looksLikeApiKey(value: string) {
  return /^sk-[A-Za-z0-9_-]{16,}$/.test(value.trim());
}

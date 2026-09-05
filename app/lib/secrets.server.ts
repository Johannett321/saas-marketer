import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for the API keys people store in their profile.
 *
 * Keys belong to the person who pasted them, so they must not sit in the database
 * as plaintext: anyone with a database dump would otherwise be able to spend their
 * OpenAI credit. AES-256-GCM gives us confidentiality plus tamper detection, and
 * `node:crypto` means no extra dependency.
 *
 * The encryption key is derived from `SESSION_SECRET`, which every install already
 * has to set. Rotating `SESSION_SECRET` therefore invalidates stored API keys as
 * well as sessions — the app treats an undecryptable key as "no key set" and asks
 * the user to paste it again, so rotation degrades gracefully instead of crashing.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function encryptionKey() {
  if (cachedKey) return cachedKey;

  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");

  // SESSION_SECRET is an arbitrary-length string; hash it into the 32 bytes AES needs.
  cachedKey = createHash("sha256").update(`ai-credentials:${secret}`).digest();
  return cachedKey;
}

/** Returns `v1:<iv>:<authTag>:<ciphertext>`, all base64url. */
export function encryptSecret(plaintext: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

/**
 * Reverses `encryptSecret`. Returns null rather than throwing when the payload is
 * unreadable — a rotated `SESSION_SECRET` or a hand-edited row should degrade to
 * "no key set", not take down every AI route.
 */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;

  const [version, iv, authTag, ciphertext] = payload.split(":");
  if (version !== "v1" || !iv || !authTag || !ciphertext) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

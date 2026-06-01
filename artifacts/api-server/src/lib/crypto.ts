import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { logger } from "./logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  // Accept 32-byte hex (64 chars) or 32-char raw key
  if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  // Derive a 32-byte key from an arbitrary string using SHA-256
  return createHash("sha256").update(raw).digest();
}

function requireEncryptionKey(): Buffer {
  const key = getEncryptionKey();
  if (!key) {
    const message = "ENCRYPTION_KEY is required for secret encryption";
    logger.error(message);
    throw new Error(message);
  }
  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Output format: "gcm:<base64(iv:tag:ciphertext)>"
 */
export function encryptSecret(plaintext: string): string {
  const key = requireEncryptionKey();

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]);
  return `gcm:${payload.toString("base64")}`;
}

/**
 * Decrypt a value produced by encryptSecret().
 * Returns null on decryption failure.
 */
export function decryptSecret(stored: string): string | null {
  try {
    if (stored.startsWith("b64:")) {
      return Buffer.from(stored.slice(4), "base64").toString("utf8");
    }

    if (!stored.startsWith("gcm:")) {
      // Legacy plain base64 (pre-encryption migration)
      return Buffer.from(stored, "base64").toString("utf8");
    }

    const key = getEncryptionKey();
    if (!key) {
      logger.error("ENCRYPTION_KEY required to decrypt a GCM-encrypted value but is not set");
      return null;
    }

    const payload = Buffer.from(stored.slice(4), "base64");
    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch (err) {
    logger.error({ err }, "Failed to decrypt secret");
    return null;
  }
}

/**
 * Hash an API key for storage (SHA-256 hex).
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a secure random API key with prefix.
 * Format: srx_<random 32 hex chars>
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const random = randomBytes(24).toString("base64url");
  const key = `srx_${random}`;
  const prefix = key.slice(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

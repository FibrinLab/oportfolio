// Key hierarchy (ADR-007):
//   passphrase --PBKDF2-SHA256--> KEK_p ─┐
//                                        ├─ wrap ─> Diary Key (AES-256-GCM, random)
//   recovery key --HKDF-SHA256---> KEK_r ─┘
// The diary key encrypts content. Only the two wrapped copies leave the
// browser. Changing the passphrase re-wraps the same diary key, so content
// never needs re-encrypting.

import { fromBase64Url, randomBytes, toBase64Url, type Bytes } from "./envelope";

export const PBKDF2_ITERATIONS = 600_000;
export const DIARY_KEY_VERSION = 1;

export interface WrappedKey {
  iv: string; // base64url
  ct: string; // base64url (wrapped raw key + tag)
}

export interface DiaryKeyMaterial {
  keyVersion: number;
  kdf: { alg: "PBKDF2-SHA256"; iterations: number };
  passphraseSalt: string; // base64url, 16 bytes
  wrappedByPassphrase: WrappedKey;
  recoverySalt: string; // base64url, 16 bytes
  wrappedByRecovery: WrappedKey;
}

const encoder = new TextEncoder();

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle;
}

export const MIN_PASSPHRASE_LENGTH = 12;

export function passphraseProblem(passphrase: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `Use at least ${MIN_PASSPHRASE_LENGTH} characters — a short sentence works well.`;
  }
  if (/^(.)\1+$/.test(passphrase)) return "That passphrase is a single repeated character.";
  return null;
}

// Normalise so the same passphrase typed on different keyboards derives the
// same key (NFKC; leading/trailing whitespace is a classic lock-out cause).
export function normalisePassphrase(passphrase: string): string {
  return passphrase.normalize("NFKC").trim();
}

export async function deriveKekFromPassphrase(
  passphrase: string,
  salt: Bytes,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", encoder.encode(normalisePassphrase(passphrase)), "PBKDF2", false, [
    "deriveKey",
  ]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

// Recovery keys: 128 bits of entropy, shown as 26 base32 characters in groups
// of five plus a final single. Case-insensitive; separators ignored.
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateRecoveryKey(): string {
  const bytes = randomBytes(16);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out.match(/.{1,5}/g)!.join("-");
}

export function normaliseRecoveryKey(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  return cleaned.length === 26 ? cleaned : null;
}

export async function deriveKekFromRecovery(recoveryKey: string, salt: Bytes): Promise<CryptoKey> {
  const cleaned = normaliseRecoveryKey(recoveryKey);
  if (!cleaned) throw new Error("Recovery key must be 26 letters and digits.");
  const base = await subtle().importKey("raw", encoder.encode(cleaned), "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("oportfolio-recovery-kek-v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

export async function generateDiaryKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function wrapDiaryKey(diaryKey: CryptoKey, kek: CryptoKey): Promise<WrappedKey> {
  const iv = randomBytes(12);
  const wrapped = await subtle().wrapKey("raw", diaryKey, kek, { name: "AES-GCM", iv, tagLength: 128 });
  return { iv: toBase64Url(iv), ct: toBase64Url(new Uint8Array(wrapped)) };
}

export async function unwrapDiaryKey(
  wrapped: WrappedKey,
  kek: CryptoKey,
  extractable: boolean,
): Promise<CryptoKey> {
  return subtle().unwrapKey(
    "raw",
    fromBase64Url(wrapped.ct),
    kek,
    { name: "AES-GCM", iv: fromBase64Url(wrapped.iv), tagLength: 128 },
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"],
  );
}

export interface SetupResult {
  material: DiaryKeyMaterial;
  recoveryKey: string;
  diaryKey: CryptoKey; // non-extractable, ready to use
}

// First-time setup: new diary key wrapped under both KEKs.
export async function setupDiaryKey(passphrase: string): Promise<SetupResult> {
  const diaryKey = await generateDiaryKey();
  const passphraseSalt = randomBytes(16);
  const recoverySalt = randomBytes(16);
  const recoveryKey = generateRecoveryKey();
  const [kekP, kekR] = await Promise.all([
    deriveKekFromPassphrase(passphrase, passphraseSalt),
    deriveKekFromRecovery(recoveryKey, recoverySalt),
  ]);
  const [wrappedByPassphrase, wrappedByRecovery] = await Promise.all([
    wrapDiaryKey(diaryKey, kekP),
    wrapDiaryKey(diaryKey, kekR),
  ]);
  const material: DiaryKeyMaterial = {
    keyVersion: DIARY_KEY_VERSION,
    kdf: { alg: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS },
    passphraseSalt: toBase64Url(passphraseSalt),
    wrappedByPassphrase,
    recoverySalt: toBase64Url(recoverySalt),
    wrappedByRecovery,
  };
  // Re-import as non-extractable for day-to-day use.
  const usable = await unwrapDiaryKey(wrappedByPassphrase, kekP, false);
  return { material, recoveryKey, diaryKey: usable };
}

export async function unlockWithPassphrase(
  material: DiaryKeyMaterial,
  passphrase: string,
  extractable = false,
): Promise<CryptoKey> {
  const kek = await deriveKekFromPassphrase(
    passphrase,
    fromBase64Url(material.passphraseSalt),
    material.kdf.iterations,
  );
  return unwrapDiaryKey(material.wrappedByPassphrase, kek, extractable);
}

export async function unlockWithRecoveryKey(
  material: DiaryKeyMaterial,
  recoveryKey: string,
  extractable = false,
): Promise<CryptoKey> {
  const kek = await deriveKekFromRecovery(recoveryKey, fromBase64Url(material.recoverySalt));
  return unwrapDiaryKey(material.wrappedByRecovery, kek, extractable);
}

// Re-wrap the existing diary key under a new passphrase (and a fresh
// recovery key). Requires an extractable handle obtained by unlocking with
// the current secret — so a stolen unlocked session cannot silently change
// the passphrase.
export async function rewrapDiaryKey(
  extractableDiaryKey: CryptoKey,
  keyVersion: number,
  newPassphrase: string,
): Promise<{ material: DiaryKeyMaterial; recoveryKey: string }> {
  const passphraseSalt = randomBytes(16);
  const recoverySalt = randomBytes(16);
  const recoveryKey = generateRecoveryKey();
  const [kekP, kekR] = await Promise.all([
    deriveKekFromPassphrase(newPassphrase, passphraseSalt),
    deriveKekFromRecovery(recoveryKey, recoverySalt),
  ]);
  const [wrappedByPassphrase, wrappedByRecovery] = await Promise.all([
    wrapDiaryKey(extractableDiaryKey, kekP),
    wrapDiaryKey(extractableDiaryKey, kekR),
  ]);
  return {
    material: {
      keyVersion,
      kdf: { alg: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS },
      passphraseSalt: toBase64Url(passphraseSalt),
      wrappedByPassphrase,
      recoverySalt: toBase64Url(recoverySalt),
      wrappedByRecovery,
    },
    recoveryKey,
  };
}

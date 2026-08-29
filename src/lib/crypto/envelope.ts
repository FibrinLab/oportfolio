// End-to-end content encryption (ADR-007). Everything here runs in the
// browser with WebCrypto; the same code runs under Node's WebCrypto in tests.
// The server only ever sees `Envelope` values and never holds a key that can
// open them.
//
// Envelope = AES-256-GCM over UTF-8 JSON, 96-bit random IV, with additional
// authenticated data binding the ciphertext to the record and field it
// belongs to (so a ciphertext cannot be moved between rows or fields).

export interface Envelope {
  v: 1;
  alg: "A256GCM";
  kid: number; // diary key version
  iv: string; // base64url, 12 bytes
  ct: string; // base64url, ciphertext || 16-byte tag
}

export const ENVELOPE_VERSION = 1 as const;

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// WebCrypto wants ArrayBuffer-backed views (TS 5.9 `BufferSource`), so every
// helper here allocates a fresh ArrayBuffer rather than a shared one.
export type Bytes = Uint8Array<ArrayBuffer>;

export function fromBase64Url(text: string): Bytes {
  const padded = text.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("WebCrypto is not available in this environment.");
  return c.subtle;
}

export function randomBytes(length: number): Bytes {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function isEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.v === 1 &&
    v.alg === "A256GCM" &&
    typeof v.kid === "number" &&
    typeof v.iv === "string" &&
    typeof v.ct === "string" &&
    v.iv.length >= 16 &&
    v.ct.length >= 22
  );
}

export async function encryptBytes(
  key: CryptoKey,
  keyVersion: number,
  plaintext: Bytes,
  aad: string,
): Promise<Envelope> {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(aad), tagLength: 128 },
    key,
    plaintext,
  );
  return { v: 1, alg: "A256GCM", kid: keyVersion, iv: toBase64Url(iv), ct: toBase64Url(new Uint8Array(ct)) };
}

export async function decryptBytes(key: CryptoKey, envelope: Envelope, aad: string): Promise<Bytes> {
  if (!isEnvelope(envelope)) throw new Error("Not a sealed value.");
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: fromBase64Url(envelope.iv), additionalData: encoder.encode(aad), tagLength: 128 },
    key,
    fromBase64Url(envelope.ct),
  );
  return new Uint8Array(plain);
}

export async function encryptJson(key: CryptoKey, keyVersion: number, value: unknown, aad: string): Promise<Envelope> {
  return encryptBytes(key, keyVersion, encoder.encode(JSON.stringify(value)), aad);
}

export async function decryptJson<T = unknown>(key: CryptoKey, envelope: Envelope, aad: string): Promise<T> {
  const bytes = await decryptBytes(key, envelope, aad);
  return JSON.parse(decoder.decode(bytes)) as T;
}

// AAD conventions — one place, so client and server agree.
export const aad = {
  evidenceTitle: (evidenceId: string) => `evidence:title:${evidenceId}`,
  evidenceNarrative: (evidenceId: string) => `evidence:narrative:${evidenceId}`,
  link: (linkId: string) => `link:${linkId}`,
  attachmentName: (attachmentId: string) => `attachment:name:${attachmentId}`,
  attachmentBytes: (attachmentId: string) => `attachment:bytes:${attachmentId}`,
  // Drafts that do not have a server id yet are bound to a client draft id;
  // the server re-binds nothing — the client re-encrypts once the id exists.
  draft: (draftId: string, field: string) => `draft:${field}:${draftId}`,
};

// Binary file format for sealed attachments: magic "OPE1", 12-byte IV, then
// AES-GCM ciphertext (tag appended). Sealed files carry no plaintext header
// beyond the magic, so the server sees only opaque bytes.
const FILE_MAGIC = encoder.encode("OPE1");

export async function sealFile(
  key: CryptoKey,
  plaintext: Bytes,
  aadValue: string,
): Promise<Bytes> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await subtle().encrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(aadValue), tagLength: 128 },
      key,
      plaintext,
    ),
  );
  const out = new Uint8Array(new ArrayBuffer(FILE_MAGIC.length + iv.length + ct.length));
  out.set(FILE_MAGIC, 0);
  out.set(iv, FILE_MAGIC.length);
  out.set(ct, FILE_MAGIC.length + iv.length);
  return out;
}

export function isSealedFile(bytes: Uint8Array): boolean {
  if (bytes.length < FILE_MAGIC.length + 12 + 16) return false;
  for (let i = 0; i < FILE_MAGIC.length; i += 1) if (bytes[i] !== FILE_MAGIC[i]) return false;
  return true;
}

export async function openFile(key: CryptoKey, sealed: Uint8Array, aadValue: string): Promise<Bytes> {
  if (!isSealedFile(sealed)) throw new Error("Not a sealed file.");
  const iv = sealed.slice(FILE_MAGIC.length, FILE_MAGIC.length + 12);
  const ct = sealed.slice(FILE_MAGIC.length + 12);
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(aadValue), tagLength: 128 },
    key,
    ct,
  );
  return new Uint8Array(plain);
}

export const SEALED_FILE_OVERHEAD_BYTES = FILE_MAGIC.length + 12 + 16;

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await subtle().digest("SHA-256", bytes.slice());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

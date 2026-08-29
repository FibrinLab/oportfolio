import { describe, expect, it } from "vitest";
import {
  aad,
  decryptJson,
  encryptJson,
  isEnvelope,
  isSealedFile,
  openFile,
  sealFile,
  SEALED_FILE_OVERHEAD_BYTES,
  sha256Hex,
} from "@/lib/crypto/envelope";
import {
  generateRecoveryKey,
  normaliseRecoveryKey,
  passphraseProblem,
  rewrapDiaryKey,
  setupDiaryKey,
  unlockWithPassphrase,
  unlockWithRecoveryKey,
} from "@/lib/crypto/keys";

// ADR-007: the server never holds a usable key. These tests run the exact
// browser code under Node's WebCrypto.

describe("diary key lifecycle", () => {
  it("sets up, unlocks with passphrase or recovery key, and rejects wrong secrets", async () => {
    const setup = await setupDiaryKey("correct horse battery staple");
    expect(setup.recoveryKey).toMatch(/^[A-Z2-7]{5}(-[A-Z2-7]{5}){4}-[A-Z2-7]$/);
    expect(setup.material.wrappedByPassphrase.ct).not.toEqual(setup.material.wrappedByRecovery.ct);

    const sealed = await encryptJson(setup.diaryKey, 1, { hello: "world" }, aad.evidenceTitle("e1"));
    expect(isEnvelope(sealed)).toBe(true);

    const viaPassphrase = await unlockWithPassphrase(setup.material, "  correct horse battery staple ");
    expect(await decryptJson(viaPassphrase, sealed, aad.evidenceTitle("e1"))).toEqual({ hello: "world" });

    const viaRecovery = await unlockWithRecoveryKey(setup.material, setup.recoveryKey.toLowerCase());
    expect(await decryptJson(viaRecovery, sealed, aad.evidenceTitle("e1"))).toEqual({ hello: "world" });

    await expect(unlockWithPassphrase(setup.material, "wrong passphrase!!")).rejects.toThrow();
    await expect(unlockWithRecoveryKey(setup.material, generateRecoveryKey())).rejects.toThrow();
  }, 30_000);

  it("re-wraps the same diary key under a new passphrase without touching content", async () => {
    const setup = await setupDiaryKey("first passphrase here");
    const sealed = await encryptJson(setup.diaryKey, 1, "secret", aad.evidenceNarrative("e2"));
    const extractable = await unlockWithPassphrase(setup.material, "first passphrase here", true);
    const rewrapped = await rewrapDiaryKey(extractable, 1, "second passphrase here");
    const reopened = await unlockWithPassphrase(rewrapped.material, "second passphrase here");
    expect(await decryptJson(reopened, sealed, aad.evidenceNarrative("e2"))).toBe("secret");
    await expect(unlockWithPassphrase(rewrapped.material, "first passphrase here")).rejects.toThrow();
  }, 30_000);

  it("validates passphrases and recovery keys", () => {
    expect(passphraseProblem("short")).toMatch(/at least 12/);
    expect(passphraseProblem("aaaaaaaaaaaaaa")).toMatch(/repeated/);
    expect(passphraseProblem("a decent sentence")).toBeNull();
    expect(normaliseRecoveryKey("abcde-fghij-klmno-pqrst-uvwxy-z")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(normaliseRecoveryKey("too short")).toBeNull();
  });
});

describe("envelopes", () => {
  it("binds ciphertext to its record and field via AAD", async () => {
    const setup = await setupDiaryKey("binding test passphrase");
    const sealed = await encryptJson(setup.diaryKey, 1, "title", aad.evidenceTitle("e1"));
    await expect(decryptJson(setup.diaryKey, sealed, aad.evidenceTitle("e2"))).rejects.toThrow();
    await expect(decryptJson(setup.diaryKey, sealed, aad.evidenceNarrative("e1"))).rejects.toThrow();
    // Tampering with a single ciphertext character fails authentication.
    const tampered = { ...sealed, ct: (sealed.ct[0] === "A" ? "B" : "A") + sealed.ct.slice(1) };
    await expect(decryptJson(setup.diaryKey, tampered, aad.evidenceTitle("e1"))).rejects.toThrow();
  }, 30_000);

  it("seals and opens files with the OPE1 container", async () => {
    const setup = await setupDiaryKey("file sealing passphrase");
    const plain = new TextEncoder().encode("hello, this is a small file");
    const sealed = await sealFile(setup.diaryKey, plain, aad.attachmentBytes("a1"));
    expect(isSealedFile(sealed)).toBe(true);
    expect(sealed.length).toBe(plain.length + SEALED_FILE_OVERHEAD_BYTES);
    expect(new TextDecoder().decode(await openFile(setup.diaryKey, sealed, aad.attachmentBytes("a1")))).toBe(
      "hello, this is a small file",
    );
    await expect(openFile(setup.diaryKey, sealed, aad.attachmentBytes("a2"))).rejects.toThrow();
    expect(await sha256Hex(new Uint8Array([]))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  }, 30_000);
});

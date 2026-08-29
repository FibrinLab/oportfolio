"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "@/lib/apiClient";
import { clearDeviceKeys, loadDeviceKey, storeDeviceKey } from "./deviceStore";
import {
  rewrapDiaryKey,
  setupDiaryKey,
  unlockWithPassphrase,
  unlockWithRecoveryKey,
  type DiaryKeyMaterial,
} from "./keys";

// Browser-side state for end-to-end encryption (ADR-007). The diary key
// (non-extractable CryptoKey) lives in this module for the life of the
// JavaScript context — it survives client-side navigation without a React
// provider above the page, which matters because a client boundary around
// `children` in the shell layout would turn page-level not-found responses
// into 200s. Across full page loads the key comes back from IndexedDB for
// the length of the sign-in session (12 h, cleared on sign-out or lock), or
// indefinitely when the user ticks "keep this device unlocked".

export type LockStatus = "loading" | "setup" | "locked" | "unlocked" | "unavailable";

interface LockState {
  status: LockStatus;
  key: CryptoKey | null;
  material: DiaryKeyMaterial | null;
  rememberDevice: boolean;
}

export interface DiaryLock extends LockState {
  keyVersion: number;
  setRememberDevice: (value: boolean) => void;
  setup: (passphrase: string) => Promise<string>;
  unlock: (secret: string, kind: "passphrase" | "recovery") => Promise<void>;
  changePassphrase: (current: string, next: string) => Promise<string>;
  lock: () => Promise<void>;
}

const REMEMBER_FLAG = "diary-lock:remember-device";
// Matches SESSION_ABSOLUTE_HOURS: the diary never stays openable on a device
// longer than the sign-in that opened it, unless the user opts in.
const SESSION_KEY_TTL_MS = 12 * 60 * 60 * 1000;

function deviceExpiry(): number | null {
  return readRememberFlag() ? null : Date.now() + SESSION_KEY_TTL_MS;
}
const SERVER_SNAPSHOT: LockState = { status: "loading", key: null, material: null, rememberDevice: false };

let state: LockState = { ...SERVER_SNAPSHOT };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: Partial<LockState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRememberFlag(): boolean {
  try {
    return localStorage.getItem(REMEMBER_FLAG) === "1";
  } catch {
    return false;
  }
}

// The key endpoints are user-scoped; the tenant header is irrelevant.
const NO_TENANT = "";

function ensureLoaded(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    emit({ rememberDevice: readRememberFlag() });
    const result = await api<{ material: DiaryKeyMaterial | null }>("/api/v1/me/diary-key", { tenantSlug: NO_TENANT });
    if (!result.ok) {
      emit({ status: "unavailable" });
      return;
    }
    if (!result.data.material) {
      emit({ status: "setup", material: null });
      return;
    }
    const material = result.data.material;
    const stored = await loadDeviceKey(material.passphraseSalt);
    if (stored) {
      emit({ status: "unlocked", key: stored.key, material });
      return;
    }
    emit({ status: "locked", material });
  })().catch(() => emit({ status: "unavailable" }));
  return loading;
}

async function persistMaterial(next: DiaryKeyMaterial): Promise<void> {
  const saved = await api("/api/v1/me/diary-key", { method: "PUT", tenantSlug: NO_TENANT, body: { material: next } });
  if (!saved.ok) throw new Error(String(saved.problem.detail ?? "The diary key could not be saved."));
  emit({ material: next });
}

const actions = {
  setRememberDevice(value: boolean) {
    try {
      localStorage.setItem(REMEMBER_FLAG, value ? "1" : "0");
    } catch {
      // storage unavailable
    }
    emit({ rememberDevice: value });
    if (state.key && state.material) {
      void storeDeviceKey(state.material.passphraseSalt, {
        key: state.key,
        keyVersion: state.material.keyVersion,
        expiresAt: value ? null : Date.now() + SESSION_KEY_TTL_MS,
      });
    }
  },
  async setup(passphrase: string): Promise<string> {
    const created = await setupDiaryKey(passphrase);
    await persistMaterial(created.material);
    emit({ status: "unlocked", key: created.diaryKey });
    await storeDeviceKey(created.material.passphraseSalt, {
      key: created.diaryKey,
      keyVersion: created.material.keyVersion,
      expiresAt: deviceExpiry(),
    });
    return created.recoveryKey;
  },
  async unlock(secret: string, kind: "passphrase" | "recovery"): Promise<void> {
    const material = state.material;
    if (!material) throw new Error("No diary key is set up yet.");
    const unlocked =
      kind === "passphrase" ? await unlockWithPassphrase(material, secret) : await unlockWithRecoveryKey(material, secret);
    emit({ status: "unlocked", key: unlocked });
    await storeDeviceKey(material.passphraseSalt, {
      key: unlocked,
      keyVersion: material.keyVersion,
      expiresAt: deviceExpiry(),
    });
  },
  async changePassphrase(current: string, next: string): Promise<string> {
    const material = state.material;
    if (!material) throw new Error("No diary key is set up yet.");
    // Re-derive from the current secret: an unlocked tab alone cannot change
    // the passphrase.
    const extractable = await unlockWithPassphrase(material, current, true);
    const rewrapped = await rewrapDiaryKey(extractable, material.keyVersion, next);
    await persistMaterial(rewrapped.material);
    await clearDeviceKeys();
    if (state.key) {
      await storeDeviceKey(rewrapped.material.passphraseSalt, {
        key: state.key,
        keyVersion: material.keyVersion,
        expiresAt: deviceExpiry(),
      });
    }
    return rewrapped.recoveryKey;
  },
  async lock(): Promise<void> {
    await clearDeviceKeys();
    emit({ status: state.material ? "locked" : "setup", key: null });
  },
};

export function useDiaryLock(): DiaryLock {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
  useEffect(() => {
    void ensureLoaded();
  }, []);
  return useMemo(
    () => ({
      ...snapshot,
      keyVersion: snapshot.material?.keyVersion ?? 1,
      setRememberDevice: actions.setRememberDevice,
      setup: actions.setup,
      unlock: actions.unlock,
      changePassphrase: actions.changePassphrase,
      lock: actions.lock,
    }),
    [snapshot],
  );
}

// The unlocked key, or throws — for code paths the gate already protects.
export function requireDiaryKey(lock: DiaryLock): { key: CryptoKey; keyVersion: number } {
  if (!lock.key) throw new Error("The diary is locked.");
  return { key: lock.key, keyVersion: lock.keyVersion };
}

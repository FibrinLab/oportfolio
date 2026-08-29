"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Autosave (FR-EV-007): debounce 2s after the last change, flush on blur and
// visibilitychange, mirror to localStorage for local recovery, and surface
// save state. Conflicts (412) are handed to the caller — never silently
// overwritten (AC-04).

export type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "offline"; at: Date }
  | { kind: "conflict"; serverSavedAt?: string; serverSavedBy?: string | null; currentRowVersion?: number }
  | { kind: "error"; message: string };

export interface AutosaveController<TDraft> {
  state: SaveState;
  markDirty: (draft: TDraft) => void;
  flush: () => Promise<void>;
  // After the user resolves a conflict.
  resetTo: (rowVersion: number) => void;
}

const DEBOUNCE_MS = 2000;

export function useAutosave<TDraft>(options: {
  // null disables the localStorage mirror (sealed diaries keep no plaintext
  // at rest on the device — ADR-007).
  storageKey: string | null;
  initialRowVersion: number;
  save: (
    draft: TDraft,
    rowVersion: number,
  ) => Promise<
    | { ok: true; rowVersion: number }
    | { ok: false; conflict?: { currentRowVersion?: number; serverSavedAt?: string; serverSavedBy?: string | null } ; offline?: boolean; message?: string }
  >;
}): AutosaveController<TDraft> {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const draftRef = useRef<TDraft | null>(null);
  const rowVersionRef = useRef(options.initialRowVersion);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const saveRef = useRef(options.save);
  // Latest-callback pattern, synced outside render for compiler safety.
  useEffect(() => {
    saveRef.current = options.save;
  }, [options.save]);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const flush = useCallback(async () => {
    if (savingRef.current) return;
    const draft = draftRef.current;
    if (draft === null) return;
    savingRef.current = true;
    draftRef.current = null;
    setState({ kind: "saving" });

    const result = await saveRef.current(draft, rowVersionRef.current);
    savingRef.current = false;

    if (result.ok) {
      rowVersionRef.current = result.rowVersion;
      try {
        if (options.storageKey) localStorage.removeItem(options.storageKey);
      } catch {
        // storage unavailable — server save succeeded, nothing to do
      }
      setState({ kind: "saved", at: new Date() });
      // A change may have arrived while saving.
      if (draftRef.current !== null) void flushRef.current();
      return;
    }

    // Keep the unsaved draft so nothing is lost.
    if (draftRef.current === null) draftRef.current = draft;
    if (result.conflict) {
      setState({
        kind: "conflict",
        currentRowVersion: result.conflict.currentRowVersion,
        serverSavedAt: result.conflict.serverSavedAt,
        serverSavedBy: result.conflict.serverSavedBy,
      });
      return;
    }
    if (result.offline) {
      setState({ kind: "offline", at: new Date() });
      return;
    }
    setState({ kind: "error", message: result.message ?? "Could not save" });
  }, [options.storageKey]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const markDirty = useCallback(
    (draft: TDraft) => {
      draftRef.current = draft;
      // Local mirror first: recoverable even if the network dies now.
      try {
        if (options.storageKey) localStorage.setItem(options.storageKey, JSON.stringify(draft));
      } catch {
        // private browsing/quota — server autosave still applies
      }
      setState((previous) => (previous.kind === "conflict" ? previous : { kind: "dirty" }));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [flush, options.storageKey],
  );

  const resetTo = useCallback((rowVersion: number) => {
    rowVersionRef.current = rowVersion;
    setState({ kind: "idle" });
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onVisibilityChange);
    return () => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flush]);

  return { state, markDirty, flush, resetTo };
}

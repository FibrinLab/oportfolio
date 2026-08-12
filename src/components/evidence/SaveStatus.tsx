"use client";

import type { SaveState } from "@/lib/useAutosave";

// Save state indicator (S-05 top bar): plain words, aria-live polite so
// screen readers hear changes without per-keystroke chatter.

export function SaveStatus({ state }: { state: SaveState }) {
  let text = "";
  switch (state.kind) {
    case "idle":
      text = "";
      break;
    case "dirty":
      text = "Unsaved changes";
      break;
    case "saving":
      text = "Saving…";
      break;
    case "saved":
      text = `Saved ${state.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
      break;
    case "offline":
      text = "Offline — saved on this device";
      break;
    case "conflict":
      text = "Not saved — item changed elsewhere";
      break;
    case "error":
      text = "Could not save — will retry";
      break;
  }
  return (
    <span
      role="status"
      aria-live="polite"
      style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}
    >
      {text}
    </span>
  );
}

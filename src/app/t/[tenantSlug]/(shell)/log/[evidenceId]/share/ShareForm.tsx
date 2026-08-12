"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import forms from "@/components/ds/forms.module.css";

type Audience = "private" | "supervisors" | "faculty";

const OPTIONS: Array<{ value: Audience; label: string; description: string }> = [
  {
    value: "private",
    label: "Only me",
    description: "No one else can see this entry, its files or its links.",
  },
  {
    value: "supervisors",
    label: "Me + supervisors",
    description: "Your currently assigned supervisors can read this entry and its attachments.",
  },
  {
    value: "faculty",
    label: "Me + supervisors + faculty",
    description:
      "Your supervisors and authorised programme faculty can read this entry and its attachments.",
  },
];

export function ShareForm({
  tenantSlug,
  evidenceId,
  currentVisibility,
  supervisorNames,
  attachments,
  links,
  missingForSharing,
}: {
  tenantSlug: string;
  evidenceId: string;
  currentVisibility: Audience;
  supervisorNames: string[];
  attachments: Array<{ displayName: string; scanStatus: string }>;
  links: string[];
  missingForSharing: string[];
}) {
  const [audience, setAudience] = useState<Audience>(currentVisibility);
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");

  const broadening = audience !== "private" && currentVisibility === "private";
  const blocked = audience !== "private" && missingForSharing.length > 0;

  async function onConfirm() {
    setState("submitting");
    const result = await api(`/api/v1/evidence/${evidenceId}/share`, {
      method: "POST",
      tenantSlug,
      idempotencyKey: crypto.randomUUID(),
      body: { visibility: audience, audienceConfirmed: true },
    });
    if (!result.ok) {
      setState("error");
      return;
    }
    window.location.assign(`/t/${tenantSlug}/log/${evidenceId}`);
  }

  return (
    <div>
      <fieldset style={{ border: "2px solid var(--ink)", padding: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <legend style={{ fontWeight: 700, padding: "0 var(--space-2)" }}>Audience</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className={forms.checkboxRow}>
            <input
              type="radio"
              name="audience"
              value={option.value}
              checked={audience === option.value}
              onChange={() => setAudience(option.value)}
            />
            <span>
              <strong>{option.label}</strong>
              <span style={{ display: "block", fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <section aria-labelledby="preview-heading" className={forms.notice}>
        <p id="preview-heading" className={forms.noticeTitle}>
          Who will see this
        </p>
        {audience === "private" ? (
          <p>Only you.</p>
        ) : (
          <>
            <p>
              {supervisorNames.length > 0
                ? `You and ${supervisorNames.join(", ")}`
                : "You — no supervisor is currently assigned, so no one gains access yet"}
              {audience === "faculty" ? ", plus authorised programme faculty" : ""}.
            </p>
            {attachments.length > 0 ? (
              <>
                <p style={{ marginTop: "var(--space-2)", fontWeight: 700 }}>
                  Files included ({attachments.length})
                </p>
                <ul style={{ paddingLeft: "var(--space-5)" }}>
                  {attachments.map((file, index) => (
                    <li key={index}>
                      {file.displayName}
                      {file.scanStatus !== "clean" ? " — [SCANNING] not yet available to others" : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {links.length > 0 ? (
              <>
                <p style={{ marginTop: "var(--space-2)", fontWeight: 700 }}>
                  Links included ({links.length})
                </p>
                <ul style={{ paddingLeft: "var(--space-5)" }}>
                  {links.map((link, index) => (
                    <li key={index}>{link}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </section>

      {blocked ? (
        <div role="alert" className={forms.notice}>
          <p className={forms.noticeTitle}>Before sharing, this entry needs</p>
          <ul style={{ paddingLeft: "var(--space-5)" }}>
            {missingForSharing.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {state === "error" ? (
        <p role="alert" className={forms.error}>
          ERROR: The change could not be saved. Try again.
        </p>
      ) : null}

      <button
        type="button"
        className={forms.buttonPrimary}
        disabled={state === "submitting" || blocked || audience === currentVisibility}
        onClick={() => void onConfirm()}
      >
        {audience === "private"
          ? "Make this entry private"
          : broadening
            ? `Share with ${audience === "supervisors" ? "supervisors" : "supervisors and faculty"}`
            : "Update audience"}
      </button>
    </div>
  );
}

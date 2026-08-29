"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import { useAutosave } from "@/lib/useAutosave";
import forms from "@/components/ds/forms.module.css";
import styles from "./EvidenceEditor.module.css";
import { FilesAndLinks } from "./FilesAndLinks";
import { ObjectivePicker, type PickerObjective } from "./ObjectivePicker";
import { SaveStatus } from "./SaveStatus";
import { DiaryEntryActions } from "./DiaryEntryActions";
import {
  REFLECTION_ACK_LABEL,
  REFLECTION_SAFETY_TEXT,
} from "./typeFields";

// The rich editor is the largest client chunk — load it only on editor routes
// (NFR-P-006).
const NarrativeEditor = dynamic(
  () => import("./NarrativeEditor").then((m) => m.NarrativeEditor),
  { ssr: false, loading: () => <p>Loading editor…</p> },
);

export interface EditorEvidence {
  id: string | null;
  title: string;
  activityDate: string | null;
  evidenceTypeId: string | null;
  narrativeDoc: unknown;
  objectiveIds: string[];
  rowVersion: number;
}

export interface EditorOptions {
  types: Array<{ id: string; stableCode: string; label: string; description: string | null }>;
}

interface DraftPayload {
  title: string;
  activityDate: string | null;
  evidenceTypeId: string | null;
  narrativeDoc: unknown;
}

export function EvidenceEditor({
  tenantSlug,
  enrolmentId,
  initial,
  options,
  pickerObjectives,
  frameworkLabel,
  reflectionAcknowledgedBefore,
  initialFiles = [],
  initialLinks = [],
}: {
  tenantSlug: string;
  enrolmentId: string;
  initial: EditorEvidence;
  options: EditorOptions;
  pickerObjectives: PickerObjective[];
  frameworkLabel: string | null;
  reflectionAcknowledgedBefore: boolean;
  initialFiles?: Array<{ id: string; displayName: string; sizeBytes: number; scanStatus: string }>;
  initialLinks?: Array<{ id: string; url: string; host: string; label: string | null }>;
}) {
  const [evidenceId, setEvidenceId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [activityDate, setActivityDate] = useState(initial.activityDate ?? "");
  const [evidenceTypeId, setEvidenceTypeId] = useState(initial.evidenceTypeId ?? "");
  const [objectiveIds, setObjectiveIds] = useState<string[]>(initial.objectiveIds);
  const [reflectionAck, setReflectionAck] = useState(reflectionAcknowledgedBefore);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const narrativeRef = useRef<unknown>(initial.narrativeDoc);
  const evidenceIdRef = useRef(initial.id);
  const objectiveIdsRef = useRef(initial.objectiveIds);
  useEffect(() => {
    objectiveIdsRef.current = objectiveIds;
  }, [objectiveIds]);

  const selectedType = options.types.find((t) => t.id === evidenceTypeId);
  const typeCode = selectedType?.stableCode ?? "entry";
  const isReflection = typeCode === "reflection";

  // Latest-fields ref: touch() runs inside change handlers where the state
  // setters have not re-rendered yet, so reading state through a closure
  // would send stale values. Handlers pass their fresh value as an override;
  // the ref carries everything else from the last committed render.
  const fieldsRef = useRef({ title, activityDate, evidenceTypeId });
  useEffect(() => {
    fieldsRef.current = { title, activityDate, evidenceTypeId };
  }, [title, activityDate, evidenceTypeId]);

  const buildDraft = useCallback((overrides?: Partial<typeof fieldsRef.current>): DraftPayload => {
    const current = { ...fieldsRef.current, ...overrides };
    return {
      title: current.title,
      activityDate: current.activityDate || null,
      evidenceTypeId: current.evidenceTypeId || null,
      narrativeDoc: narrativeRef.current,
    };
  }, []);

  const save = useCallback(
    async (draft: DraftPayload, rowVersion: number) => {
      // Reflections require the safety acknowledgement before the first save
      // (FR-EV-008) — hold changes locally until it is ticked.
      const draftIsReflection =
        options.types.find((t) => t.id === draft.evidenceTypeId)?.stableCode === "reflection";
      if (draftIsReflection && !reflectionAck && !evidenceIdRef.current) {
        return { ok: false as const, message: "Confirm the reflection safety note to save." };
      }

      if (!evidenceIdRef.current) {
        if (!draft.title.trim()) {
          // Nothing worth creating yet; report saved-nothing as offline-style no-op.
          return { ok: false as const, message: "Add a title to start the draft." };
        }
        const created = await api<{ id: string; rowVersion: number }>(
          `/api/v1/enrolments/${enrolmentId}/diary-entries`,
          {
            method: "POST",
            tenantSlug,
            body: {
              title: draft.title.trim(),
              activityDate: draft.activityDate,
              evidenceTypeId: draft.evidenceTypeId,
              narrativeDoc: draft.narrativeDoc,
              reflectionAcknowledged: draftIsReflection ? reflectionAck : undefined,
            },
            idempotencyKey: crypto.randomUUID(),
          },
        );
        if (!created.ok) {
          return { ok: false as const, message: String(created.problem.detail ?? "Could not create") };
        }
        evidenceIdRef.current = created.data.id;
        setEvidenceId(created.data.id);
        window.history.replaceState(null, "", `/t/${tenantSlug}/log/${created.data.id}`);
        // Sync mappings picked before the draft existed.
        if (objectiveIdsRef.current.length > 0) {
          void api(`/api/v1/diary-entries/${created.data.id}/objectives`, {
            method: "PUT",
            tenantSlug,
            body: { objectiveIds: objectiveIdsRef.current },
          });
        }
        return {
          ok: true as const,
          rowVersion: created.data.rowVersion,
        };
      }

      const result = await api<{ rowVersion: number }>(
        `/api/v1/diary-entries/${evidenceIdRef.current}`,
        {
          method: "PATCH",
          tenantSlug,
          ifMatch: rowVersion,
          body: draft,
        },
      );
      if (result.ok) return { ok: true as const, rowVersion: result.data.rowVersion };
      if (result.problem.status === 412) {
        // Preserve this tab's words server-side BEFORE showing the choice —
        // the conflict panel promises they are recoverable (AC-04).
        await api(`/api/v1/diary-entries/${evidenceIdRef.current}/revisions`, {
          method: "POST",
          tenantSlug,
          body: { snapshot: draft as unknown as Record<string, unknown> },
        });
        return {
          ok: false as const,
          conflict: {
            currentRowVersion: result.problem.currentRowVersion as number | undefined,
            serverSavedAt: result.problem.serverSavedAt as string | undefined,
            serverSavedBy: result.problem.serverSavedBy as string | null | undefined,
          },
        };
      }
      if (result.problem.status === 0) return { ok: false as const, offline: true };
      return { ok: false as const, message: String(result.problem.detail ?? "Could not save") };
    },
    [enrolmentId, tenantSlug, reflectionAck, options.types],
  );

  const autosave = useAutosave<DraftPayload>({
    storageKey: `evidence-draft:${evidenceId ?? "new"}`,
    initialRowVersion: initial.rowVersion,
    save,
  });

  const touch = useCallback(
    (overrides?: Partial<typeof fieldsRef.current>) => {
      autosave.markDirty(buildDraft(overrides));
    },
    [autosave, buildDraft],
  );

  async function syncObjectives(next: string[]) {
    setObjectiveIds(next);
    setMappingError(null);
    if (!evidenceIdRef.current) {
      touch();
      return;
    }
    const result = await api(`/api/v1/diary-entries/${evidenceIdRef.current}/objectives`, {
      method: "PUT",
      tenantSlug,
      body: { objectiveIds: next },
    });
    if (!result.ok) {
      setMappingError(String(result.problem.detail ?? "Could not update objectives."));
    }
  }

  const conflict = autosave.state.kind === "conflict" ? autosave.state : null;

  return (
    <div style={{ maxWidth: "var(--content-max)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          borderBottom: "1px solid var(--rule)",
          paddingBottom: "var(--space-3)",
          marginBottom: "var(--space-5)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          <Link href={`/t/${tenantSlug}/log`}>Back to diary</Link>
          <span className="stamp">[PRIVATE DIARY]</span>
          <SaveStatus state={autosave.state} />
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button type="button" className={forms.buttonSecondary} onClick={() => void autosave.flush()}>
            Save draft
          </button>
        </div>
      </div>

      {evidenceId ? (
        <DiaryEntryActions tenantSlug={tenantSlug} entryId={evidenceId} mode="active" />
      ) : null}

      {conflict ? (
        <div role="alert" className={forms.notice} style={{ borderLeftWidth: 4 }}>
          <p className={forms.noticeTitle}>This item was saved elsewhere</p>
          <p>
            {conflict.serverSavedBy ? `${conflict.serverSavedBy} saved` : "It was saved"} a newer
            version{conflict.serverSavedAt ? ` at ${new Date(conflict.serverSavedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}.
            Your words from this tab have been preserved in the revision history.
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <button
              type="button"
              className={forms.buttonPrimary}
              onClick={() => {
                if (conflict.currentRowVersion) {
                  autosave.resetTo(conflict.currentRowVersion);
                  touch();
                }
              }}
            >
              Keep my version
            </button>
            <button
              type="button"
              className={forms.buttonSecondary}
              onClick={() => window.location.reload()}
            >
              Use the newer version
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.editorGrid}>
        <div>
          <div className={forms.field}>
            <label htmlFor="ev-title" className={forms.label}>
              Title <span style={{ fontWeight: 400 }}>(Required)</span>
            </label>
            <p className={forms.hint}>5–160 characters. Describe the work, not the patient or case.</p>
            <input
              id="ev-title"
              className={forms.input}
              value={title}
              maxLength={160}
              onChange={(event) => {
                setTitle(event.target.value);
                touch({ title: event.target.value });
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
            <div className={forms.field} style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="ev-date" className={forms.label}>
                Activity date
              </label>
              <input
                id="ev-date"
                type="date"
                className={forms.input}
                value={activityDate}
                onChange={(event) => {
                  setActivityDate(event.target.value);
                  touch({ activityDate: event.target.value });
                }}
              />
            </div>
            <div className={forms.field} style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="ev-type" className={forms.label}>
                Entry type <span style={{ fontWeight: 400 }}>(Optional)</span>
              </label>
              <select
                id="ev-type"
                className={forms.select}
                value={evidenceTypeId}
                onChange={(event) => {
                  setEvidenceTypeId(event.target.value);
                  touch({ evidenceTypeId: event.target.value });
                }}
              >
                <option value="">No type</option>
                {options.types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isReflection ? (
            <div className={forms.notice}>
              <p className={forms.noticeTitle}>PRIVACY</p>
              <p>{REFLECTION_SAFETY_TEXT}</p>
              <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                Prompts: What happened? So what does it mean for your practice? Now what will you
                do differently?
              </p>
              {!reflectionAcknowledgedBefore ? (
                <label className={forms.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={reflectionAck}
                    onChange={(event) => setReflectionAck(event.target.checked)}
                  />
                  <span>{REFLECTION_ACK_LABEL}</span>
                </label>
              ) : null}
            </div>
          ) : null}

          <div className={forms.field}>
            <span id="ev-narrative-label" className={forms.label}>
              Reflection
            </span>
            <p className={forms.hint}>
              20–20,000 characters. Headings, lists, bold, italics and safe links are available.
            </p>
            <NarrativeEditor
              initialDoc={initial.narrativeDoc}
              labelledBy="ev-narrative-label"
              onChange={(doc) => {
                narrativeRef.current = doc;
                touch();
              }}
            />
          </div>

        </div>

        <aside aria-label="Entry details">
          {frameworkLabel ? (
            <div className={forms.field}>
              <ObjectivePicker
                objectives={pickerObjectives}
                selectedIds={objectiveIds}
                onChange={(next) => void syncObjectives(next)}
                frameworkLabel={frameworkLabel}
              />
              {mappingError ? (
                <p role="alert" className={forms.error}>
                  ERROR: {mappingError}
                </p>
              ) : null}
              {!evidenceId ? (
                <p className={forms.hint}>Objective mappings save once the draft is created.</p>
              ) : null}
            </div>
          ) : null}

          {evidenceId ? (
            <FilesAndLinks
              tenantSlug={tenantSlug}
              evidenceId={evidenceId}
              initialFiles={initialFiles}
              initialLinks={initialLinks}
            />
          ) : (
            <p className={forms.hint}>Files and links can be added once the draft is created.</p>
          )}

          <div className={forms.notice}>
            <p className={forms.noticeTitle}>PRIVACY</p>
            <p>
              This entry is visible only to you. Other users cannot read its title, date, files,
              links, or reflection.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

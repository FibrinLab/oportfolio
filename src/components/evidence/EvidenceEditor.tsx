"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import { useAutosave } from "@/lib/useAutosave";
import forms from "@/components/ds/forms.module.css";
import { ObjectivePicker, type PickerObjective } from "./ObjectivePicker";
import { SaveStatus } from "./SaveStatus";
import {
  REFLECTION_ACK_LABEL,
  REFLECTION_SAFETY_TEXT,
  TYPE_FIELDS,
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
  evidenceTypeId: string;
  narrativeDoc: unknown;
  typeFieldsJson: Record<string, unknown> | null;
  provenanceId: string | null;
  visibility: "private" | "supervisors" | "faculty";
  workflowState: string;
  objectiveIds: string[];
  dutyIds: string[];
  rowVersion: number;
}

export interface EditorOptions {
  types: Array<{ id: string; stableCode: string; label: string; description: string | null }>;
  provenances: Array<{ id: string; stableCode: string; label: string }>;
  duties: Array<{ id: string; stableCode: string; label: string; description: string | null }>;
}

const VISIBILITY_LABEL: Record<string, string> = {
  private: "Only me",
  supervisors: "Me + supervisors",
  faculty: "Me + supervisors + faculty",
};

interface DraftPayload {
  title: string;
  activityDate: string | null;
  evidenceTypeId: string;
  narrativeDoc: unknown;
  typeFieldsJson: Record<string, unknown> | null;
  provenanceId: string | null;
}

export function EvidenceEditor({
  tenantSlug,
  enrolmentId,
  initial,
  options,
  pickerObjectives,
  frameworkLabel,
  reflectionAcknowledgedBefore,
}: {
  tenantSlug: string;
  enrolmentId: string;
  initial: EditorEvidence;
  options: EditorOptions;
  pickerObjectives: PickerObjective[];
  frameworkLabel: string;
  reflectionAcknowledgedBefore: boolean;
}) {
  const [evidenceId, setEvidenceId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [activityDate, setActivityDate] = useState(initial.activityDate ?? "");
  const [evidenceTypeId, setEvidenceTypeId] = useState(initial.evidenceTypeId);
  const [provenanceId, setProvenanceId] = useState(initial.provenanceId ?? "");
  const [typeFields, setTypeFields] = useState<Record<string, unknown>>(
    initial.typeFieldsJson ?? {},
  );
  const [objectiveIds, setObjectiveIds] = useState<string[]>(initial.objectiveIds);
  const [dutyIds, setDutyIds] = useState<string[]>(initial.dutyIds);
  const [reflectionAck, setReflectionAck] = useState(reflectionAcknowledgedBefore);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const narrativeRef = useRef<unknown>(initial.narrativeDoc);
  const evidenceIdRef = useRef(initial.id);
  const objectiveIdsRef = useRef(initial.objectiveIds);
  objectiveIdsRef.current = objectiveIds;
  const dutyIdsRef = useRef(initial.dutyIds);
  dutyIdsRef.current = dutyIds;

  const selectedType = options.types.find((t) => t.id === evidenceTypeId);
  const typeCode = selectedType?.stableCode ?? "learning_record";
  const isReflection = typeCode === "reflection";
  const extraFields = TYPE_FIELDS[typeCode] ?? [];

  const buildDraft = useCallback((): DraftPayload => {
    return {
      title,
      activityDate: activityDate || null,
      evidenceTypeId,
      narrativeDoc: narrativeRef.current,
      typeFieldsJson: Object.keys(typeFields).length ? typeFields : null,
      provenanceId: provenanceId || null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, activityDate, evidenceTypeId, typeFields, provenanceId]);

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
          `/api/v1/enrolments/${enrolmentId}/evidence`,
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
          void api(`/api/v1/evidence/${created.data.id}/objectives`, {
            method: "PUT",
            tenantSlug,
            body: { objectiveIds: objectiveIdsRef.current },
          });
        }
        if (dutyIdsRef.current.length > 0) {
          void api(`/api/v1/evidence/${created.data.id}/duties`, {
            method: "PUT",
            tenantSlug,
            body: { dutyIds: dutyIdsRef.current },
          });
        }
        // Push the remaining fields (provenance/type fields) in a follow-up PATCH.
        const followUp = await api<{ rowVersion: number }>(
          `/api/v1/evidence/${created.data.id}`,
          {
            method: "PATCH",
            tenantSlug,
            ifMatch: created.data.rowVersion,
            body: {
              typeFieldsJson: draft.typeFieldsJson,
              provenanceId: draft.provenanceId,
            },
          },
        );
        return {
          ok: true as const,
          rowVersion: followUp.ok ? followUp.data.rowVersion : created.data.rowVersion,
        };
      }

      const result = await api<{ rowVersion: number }>(
        `/api/v1/evidence/${evidenceIdRef.current}`,
        {
          method: "PATCH",
          tenantSlug,
          ifMatch: rowVersion,
          body: draft,
        },
      );
      if (result.ok) return { ok: true as const, rowVersion: result.data.rowVersion };
      if (result.problem.status === 412) {
        // Preserve this tab's words server-side before showing the choice (AC-04).
        void api(`/api/v1/evidence/${evidenceIdRef.current}/revisions`, {
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

  const touch = useCallback(() => {
    autosave.markDirty(buildDraft());
  }, [autosave, buildDraft]);

  async function syncObjectives(next: string[]) {
    setObjectiveIds(next);
    setMappingError(null);
    if (!evidenceIdRef.current) {
      touch();
      return;
    }
    const result = await api(`/api/v1/evidence/${evidenceIdRef.current}/objectives`, {
      method: "PUT",
      tenantSlug,
      body: { objectiveIds: next },
    });
    if (!result.ok) {
      setMappingError(String(result.problem.detail ?? "Could not update objectives."));
    }
  }

  async function syncDuties(next: string[]) {
    setDutyIds(next);
    if (!evidenceIdRef.current) return;
    await api(`/api/v1/evidence/${evidenceIdRef.current}/duties`, {
      method: "PUT",
      tenantSlug,
      body: { dutyIds: next },
    });
  }

  const conflict = autosave.state.kind === "conflict" ? autosave.state : null;

  const audienceLabel = VISIBILITY_LABEL[initial.visibility] ?? initial.visibility;

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
          <Link href={`/t/${tenantSlug}/log`}>Back to log</Link>
          <span className="stamp">[{initial.workflowState === "shared" ? "SHARED" : "DRAFT"}]</span>
          <span className="stamp" aria-label={`Audience: ${audienceLabel}`}>
            {audienceLabel}
          </span>
          <SaveStatus state={autosave.state} />
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button type="button" className={forms.buttonSecondary} onClick={() => void autosave.flush()}>
            Save draft
          </button>
          {evidenceId ? (
            <Link href={`/t/${tenantSlug}/log/${evidenceId}/share`} className={forms.buttonPrimary} style={{ display: "inline-flex", alignItems: "center" }}>
              Preview audience and share
            </Link>
          ) : null}
        </div>
      </div>

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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "var(--space-6)" }} data-editor-grid>
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
              }}
              onInput={touch}
            />
          </div>

          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
            <div className={forms.field} style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="ev-date" className={forms.label}>
                Activity date <span style={{ fontWeight: 400 }}>(Required to share)</span>
              </label>
              <input
                id="ev-date"
                type="date"
                className={forms.input}
                value={activityDate}
                onChange={(event) => {
                  setActivityDate(event.target.value);
                }}
                onInput={touch}
              />
            </div>
            <div className={forms.field} style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="ev-type" className={forms.label}>
                Evidence type <span style={{ fontWeight: 400 }}>(Required)</span>
              </label>
              <select
                id="ev-type"
                className={forms.select}
                value={evidenceTypeId}
                onChange={(event) => {
                  setEvidenceTypeId(event.target.value);
                  touch();
                }}
              >
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
              What happened / what this shows <span style={{ fontWeight: 400 }}>(Required to share)</span>
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

          {extraFields.length > 0 ? (
            <fieldset style={{ border: "1px solid var(--rule)", padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
              <legend style={{ fontWeight: 700, padding: "0 var(--space-2)" }}>
                {selectedType?.label} details
              </legend>
              {extraFields.map((field) => (
                <div key={field.key} className={forms.field}>
                  <label htmlFor={`tf-${field.key}`} className={forms.label}>
                    {field.label}{" "}
                    {field.required ? <span style={{ fontWeight: 400 }}>(Required to share)</span> : null}
                  </label>
                  {field.hint ? <p className={forms.hint}>{field.hint}</p> : null}
                  {field.kind === "select" ? (
                    <select
                      id={`tf-${field.key}`}
                      className={forms.select}
                      value={String(typeFields[field.key] ?? "")}
                      onChange={(event) => {
                        setTypeFields((current) => ({ ...current, [field.key]: event.target.value }));
                        touch();
                      }}
                    >
                      <option value="">Choose…</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`tf-${field.key}`}
                      type={field.kind === "date" ? "date" : "text"}
                      className={forms.input}
                      value={String(typeFields[field.key] ?? "")}
                      onChange={(event) => {
                        setTypeFields((current) => ({ ...current, [field.key]: event.target.value }));
                      }}
                      onInput={touch}
                    />
                  )}
                </div>
              ))}
            </fieldset>
          ) : null}
        </div>

        <aside aria-label="Mapping and context">
          <div className={forms.field}>
            <label htmlFor="ev-provenance" className={forms.label}>
              Delivery source <span style={{ fontWeight: 400 }}>(Required to share)</span>
            </label>
            <select
              id="ev-provenance"
              className={forms.select}
              value={provenanceId}
              onChange={(event) => {
                setProvenanceId(event.target.value);
                touch();
              }}
            >
              <option value="">Choose…</option>
              {options.provenances.map((provenance) => (
                <option key={provenance.id} value={provenance.id}>
                  {provenance.label}
                </option>
              ))}
            </select>
          </div>

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

          <fieldset style={{ border: "1px solid var(--rule)", padding: "var(--space-3)", marginBottom: "var(--space-4)" }}>
            <legend style={{ fontWeight: 700, padding: "0 var(--space-2)" }}>Fellowship duties</legend>
            {options.duties.map((dutyOption) => (
              <label key={dutyOption.id} className={forms.checkboxRow}>
                <input
                  type="checkbox"
                  checked={dutyIds.includes(dutyOption.id)}
                  onChange={(event) =>
                    void syncDuties(
                      event.target.checked
                        ? [...dutyIds, dutyOption.id]
                        : dutyIds.filter((d) => d !== dutyOption.id),
                    )
                  }
                />
                <span title={dutyOption.description ?? undefined}>{dutyOption.label}</span>
              </label>
            ))}
          </fieldset>

          <div className={forms.notice}>
            <p className={forms.noticeTitle}>PRIVACY</p>
            <p>
              Audience: <strong>{audienceLabel}</strong>. New entries are private until you
              deliberately share them.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

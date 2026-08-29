"use client";

import { useId, useMemo, useRef, useState } from "react";
import styles from "./ObjectivePicker.module.css";
import forms from "@/components/ds/forms.module.css";

// Objective selection (spec/10, spec/11): search combobox plus a hierarchical
// browse dialog; chosen items render as bordered rows with fully-named remove
// buttons; removal returns focus predictably.

export interface PickerObjective {
  id: string;
  code: string;
  title: string;
  domainCode: string;
  domainTitle: string;
}

export function ObjectivePicker({
  objectives,
  selectedIds,
  onChange,
  frameworkLabel,
}: {
  objectives: PickerObjective[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  frameworkLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  const selected = useMemo(
    () => objectives.filter((o) => selectedIds.includes(o.id)),
    [objectives, selectedIds],
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const needle = query.trim().toLowerCase();
    return objectives
      .filter(
        (o) =>
          !selectedIds.includes(o.id) &&
          (o.code.toLowerCase().includes(needle) ||
            o.title.toLowerCase().includes(needle) ||
            o.domainTitle.toLowerCase().includes(needle)),
      )
      .slice(0, 8);
  }, [objectives, query, selectedIds]);

  function add(id: string) {
    onChange([...selectedIds, id]);
    setQuery("");
    setListOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(selectedIds.filter((s) => s !== id));
    inputRef.current?.focus();
  }

  const domains = useMemo(() => {
    const byDomain = new Map<string, { code: string; title: string; items: PickerObjective[] }>();
    for (const objective of objectives) {
      const entry = byDomain.get(objective.domainCode) ?? {
        code: objective.domainCode,
        title: objective.domainTitle,
        items: [],
      };
      entry.items.push(objective);
      byDomain.set(objective.domainCode, entry);
    }
    return [...byDomain.values()];
  }, [objectives]);

  return (
    <div>
      <label htmlFor={`${baseId}-input`} className={forms.label}>
        Curriculum objectives <span style={{ fontWeight: 400 }}>(Optional)</span>
      </label>
      <p className={forms.hint}>Mapping to {frameworkLabel}. Search by code or wording, or browse by domain.</p>

      {selected.length > 0 ? (
        <ul className={styles.selectedList}>
          {selected.map((objective) => (
            <li key={objective.id} className={styles.selectedRow}>
              <span>
                <strong>{objective.code}</strong> {objective.title}
              </span>
              <button
                type="button"
                className={forms.buttonTertiary}
                onClick={() => remove(objective.id)}
              >
                Remove {objective.code}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.comboRow}>
        <div className={styles.comboWrap}>
          <input
            ref={inputRef}
            id={`${baseId}-input`}
            className={forms.input}
            role="combobox"
            aria-expanded={listOpen && results.length > 0}
            aria-controls={`${baseId}-listbox`}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined}
            autoComplete="off"
            value={query}
            placeholder="e.g. AF-01 or evaluation"
            onChange={(event) => {
              setQuery(event.target.value);
              setListOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
                event.preventDefault();
                add(results[activeIndex].id);
              } else if (event.key === "Escape") {
                setListOpen(false);
                setActiveIndex(-1);
              }
            }}
            onBlur={() => setTimeout(() => setListOpen(false), 150)}
          />
          {listOpen && query.trim() ? (
            <ul id={`${baseId}-listbox`} role="listbox" className={styles.listbox} aria-label="Matching objectives">
              <li className={styles.resultCount} role="presentation" aria-hidden>
                {results.length} match{results.length === 1 ? "" : "es"}
              </li>
              {results.map((objective, index) => (
                <li
                  key={objective.id}
                  id={`${baseId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={styles.option}
                  data-active={index === activeIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    add(objective.id);
                  }}
                >
                  <strong>{objective.code}</strong> {objective.title}
                  <span className={styles.optionDomain}>{objective.domainTitle}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="visually-hidden" role="status">
            {listOpen && query.trim() ? `${results.length} objectives match` : ""}
          </p>
        </div>
        <button type="button" className={forms.buttonSecondary} onClick={() => setBrowseOpen(true)}>
          Browse domains
        </button>
      </div>

      {browseOpen ? (
        <BrowseDialog
          domains={domains}
          selectedIds={selectedIds}
          onToggle={(id, checked) =>
            onChange(checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id))
          }
          onClose={() => {
            setBrowseOpen(false);
            inputRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function BrowseDialog({
  domains,
  selectedIds,
  onToggle,
  onClose,
}: {
  domains: Array<{ code: string; title: string; items: PickerObjective[] }>;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  return (
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={styles.dialog}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") {
            // Simple focus trap over the dialog's focusables.
            const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
              'button, input, [tabindex]:not([tabindex="-1"])',
            );
            if (!focusables || focusables.length === 0) return;
            const first = focusables[0]!;
            const last = focusables[focusables.length - 1]!;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id={headingId}>Browse curriculum objectives</h2>
          <button type="button" className={forms.buttonSecondary} onClick={onClose} autoFocus>
            Done
          </button>
        </div>
        <div className={styles.dialogBody}>
          {domains.map((domain) => (
            <section key={domain.code} aria-labelledby={`browse-${domain.code}`}>
              <h3 id={`browse-${domain.code}`} className={styles.domainHeading}>
                {domain.code} — {domain.title}
              </h3>
              {domain.items.map((objective) => (
                <label key={objective.id} className={forms.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(objective.id)}
                    onChange={(event) => onToggle(objective.id, event.target.checked)}
                  />
                  <span>
                    <strong>{objective.code}</strong> {objective.title}
                  </span>
                </label>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

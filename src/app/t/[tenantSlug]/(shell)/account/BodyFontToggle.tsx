"use client";

// "Use easier-reading body font" switches narratives/forms to the sans stack
// without changing hierarchy (spec/10). Cookie-driven so SSR renders the
// preference without a flash.

export function BodyFontToggle({ current }: { current: "mono" | "sans" }) {
  function setFont(value: "mono" | "sans") {
    document.cookie = `body-font=${value}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.bodyFont = value;
    window.location.reload();
  }

  return (
    <fieldset style={{ border: "1px solid var(--rule)", padding: "var(--space-4)", maxWidth: "var(--measure)" }}>
      <legend style={{ fontWeight: 700, padding: "0 var(--space-2)" }}>Body text font</legend>
      {(
        [
          { value: "mono", label: "Monospaced (default)" },
          { value: "sans", label: "Easier-reading body font" },
        ] as const
      ).map((option) => (
        <label
          key={option.value}
          style={{
            display: "flex",
            gap: "var(--space-3)",
            alignItems: "center",
            minHeight: "var(--target-min)",
          }}
        >
          <input
            type="radio"
            name="bodyFont"
            checked={current === option.value}
            onChange={() => setFont(option.value)}
            style={{ width: 24, height: 24, accentColor: "var(--ink)" }}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

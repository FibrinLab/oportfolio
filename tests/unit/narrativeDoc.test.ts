import { describe, expect, it } from "vitest";
import {
  extractPlainText,
  renderNarrativeHtml,
  validateNarrativeDoc,
} from "@/server/portfolio/narrativeDoc";

const paragraph = (text: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});

describe("validateNarrativeDoc", () => {
  it("accepts the allowlisted structure", () => {
    const result = validateNarrativeDoc({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Heading" }] },
        paragraph("Body text with detail."),
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [paragraph("Item one")] },
            { type: "listItem", content: [paragraph("Item two")] },
          ],
        },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.plainText).toContain("Body text with detail.");
  });

  it("rejects non-document roots", () => {
    expect(validateNarrativeDoc(null).valid).toBe(false);
    expect(validateNarrativeDoc("<p>html</p>").valid).toBe(false);
    expect(validateNarrativeDoc({ type: "paragraph" }).valid).toBe(false);
  });

  it("rejects disallowed node types", () => {
    const result = validateNarrativeDoc({
      type: "doc",
      content: [{ type: "iframe", attrs: { src: "https://evil.example" } }],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("iframe");
  });

  it("rejects javascript: links", () => {
    const result = validateNarrativeDoc({
      type: "doc",
       
      content: [paragraph("click", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects heading levels outside 2-3", () => {
    const result = validateNarrativeDoc({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "big" }] }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects unknown marks", () => {
    const result = validateNarrativeDoc({
      type: "doc",
      content: [paragraph("styled", [{ type: "textStyle", attrs: { color: "red" } }])],
    });
    expect(result.valid).toBe(false);
  });
});

describe("renderNarrativeHtml", () => {
  it("escapes every text chunk (XSS corpus)", () => {
    const payloads = [
      `<script>alert(1)</script>`,
      `"><img src=x onerror=alert(1)>`,
      `';alert(String.fromCharCode(88))//`,
      `<svg/onload=alert(1)>`,
      `</p><style>*{display:none}</style>`,
    ];
    for (const payload of payloads) {
      const validated = validateNarrativeDoc({ type: "doc", content: [paragraph(payload)] });
      expect(validated.valid).toBe(true);
      const html = renderNarrativeHtml(validated.doc!);
      expect(html).not.toContain("<script");
      expect(html).not.toContain("<img");
      expect(html).not.toContain("<svg");
      expect(html).not.toContain("<style");
      // No event handler may appear inside an actual tag; escaped text is fine.
      expect(html).not.toMatch(/<[^>]*onerror/);
    }
  });

  it("renders links with safe attributes and escaped href", () => {
    const validated = validateNarrativeDoc({
      type: "doc",
      content: [
        paragraph("docs", [
          { type: "link", attrs: { href: 'https://example.org/a"onmouseover="alert(1)' } },
        ]),
      ],
    });
    const html = renderNarrativeHtml(validated.doc!);
    expect(html).toContain("rel=\"noopener noreferrer\"");
    expect(html).not.toContain('"onmouseover="');
  });
});

describe("extractPlainText", () => {
  it("flattens blocks with line breaks", () => {
    const validated = validateNarrativeDoc({
      type: "doc",
      content: [paragraph("one"), paragraph("two")],
    });
    expect(extractPlainText(validated.doc!)).toBe("one\ntwo");
  });
});

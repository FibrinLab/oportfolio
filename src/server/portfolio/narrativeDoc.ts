// Restricted portable rich-text document (spec/05:99): canonical storage is
// structured JSON (ProseMirror-shaped); HTML is a render format only. The
// allowlist is tiny, so we walk the JSON by hand — no HTML sanitiser in the
// storage path, no unknown nodes/marks/attributes survive.
//
// Allowed nodes: doc, paragraph, heading (level 2-3), bulletList,
// orderedList, listItem, text, hardBreak.
// Allowed marks: bold, italic, link (http/https only).

export interface NarrativeDoc {
  type: "doc";
  content?: NarrativeNode[];
}

export interface NarrativeNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NarrativeNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

export interface NarrativeValidation {
  valid: boolean;
  issues: string[];
  // Normalised copy containing only allowlisted structure.
  doc: NarrativeDoc | null;
  plainText: string;
}

const MAX_NODES = 20_000;
const MAX_DEPTH = 20;

export function validateNarrativeDoc(input: unknown): NarrativeValidation {
  const issues: string[] = [];
  if (!isRecord(input) || input.type !== "doc") {
    return { valid: false, issues: ["Narrative must be a document"], doc: null, plainText: "" };
  }

  const state = { nodeCount: 0 };
  const content = normaliseChildren(input.content, "doc", 1, issues, state);
  const doc: NarrativeDoc = { type: "doc", content };
  const plainText = extractPlainText(doc);

  return { valid: issues.length === 0, issues, doc: issues.length === 0 ? doc : null, plainText };
}

const BLOCK_CHILDREN: Record<string, Set<string>> = {
  doc: new Set(["paragraph", "heading", "bulletList", "orderedList"]),
  listItem: new Set(["paragraph", "bulletList", "orderedList"]),
  bulletList: new Set(["listItem"]),
  orderedList: new Set(["listItem"]),
  paragraph: new Set(["text", "hardBreak"]),
  heading: new Set(["text", "hardBreak"]),
};

function normaliseChildren(
  children: unknown,
  parentType: string,
  depth: number,
  issues: string[],
  state: { nodeCount: number },
): NarrativeNode[] {
  if (children === undefined) return [];
  if (!Array.isArray(children)) {
    issues.push(`Invalid content in ${parentType}`);
    return [];
  }
  if (depth > MAX_DEPTH) {
    issues.push("Document nesting is too deep");
    return [];
  }
  const allowed = BLOCK_CHILDREN[parentType];
  const result: NarrativeNode[] = [];
  for (const child of children) {
    if (!isRecord(child) || typeof child.type !== "string") {
      issues.push(`Invalid node in ${parentType}`);
      continue;
    }
    state.nodeCount += 1;
    if (state.nodeCount > MAX_NODES) {
      issues.push("Document has too many nodes");
      return result;
    }
    if (!allowed?.has(child.type)) {
      issues.push(`Node type '${child.type}' is not allowed in ${parentType}`);
      continue;
    }
    result.push(normaliseNode(child, depth, issues, state));
  }
  return result;
}

function normaliseNode(
  node: Record<string, unknown>,
  depth: number,
  issues: string[],
  state: { nodeCount: number },
): NarrativeNode {
  const type = node.type as string;
  switch (type) {
    case "paragraph":
    case "bulletList":
    case "orderedList":
    case "listItem":
      return { type, content: normaliseChildren(node.content, type, depth + 1, issues, state) };
    case "heading": {
      const rawLevel = isRecord(node.attrs) ? node.attrs.level : undefined;
      // Heading levels offered are appropriate to page hierarchy: 2-3 only.
      const level = rawLevel === 2 || rawLevel === 3 ? rawLevel : 2;
      if (rawLevel !== 2 && rawLevel !== 3) {
        issues.push(`Heading level ${String(rawLevel)} is not allowed (use 2 or 3)`);
      }
      return {
        type,
        attrs: { level },
        content: normaliseChildren(node.content, type, depth + 1, issues, state),
      };
    }
    case "hardBreak":
      return { type };
    case "text": {
      const text = typeof node.text === "string" ? node.text : "";
      if (typeof node.text !== "string" || text.length === 0) {
        issues.push("Text node must contain text");
      }
      const marks = normaliseMarks(node.marks, issues);
      return marks.length > 0 ? { type, text, marks } : { type, text };
    }
    default:
      issues.push(`Node type '${type}' is not allowed`);
      return { type: "paragraph", content: [] };
  }
}

function normaliseMarks(
  marks: unknown,
  issues: string[],
): Array<{ type: string; attrs?: Record<string, unknown> }> {
  if (marks === undefined) return [];
  if (!Array.isArray(marks)) {
    issues.push("Invalid marks");
    return [];
  }
  const result: Array<{ type: string; attrs?: Record<string, unknown> }> = [];
  for (const mark of marks) {
    if (!isRecord(mark) || typeof mark.type !== "string") {
      issues.push("Invalid mark");
      continue;
    }
    switch (mark.type) {
      case "bold":
      case "italic":
        result.push({ type: mark.type });
        break;
      case "link": {
        const href = isRecord(mark.attrs) ? mark.attrs.href : undefined;
        if (typeof href !== "string" || !/^https?:\/\//i.test(href.trim())) {
          issues.push("Links must use http or https");
          break;
        }
        result.push({ type: "link", attrs: { href: href.trim() } });
        break;
      }
      default:
        issues.push(`Mark type '${mark.type}' is not allowed`);
    }
  }
  return result;
}

export function extractPlainText(doc: NarrativeDoc): string {
  const parts: string[] = [];
  const walk = (nodes: NarrativeNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "text" && node.text) parts.push(node.text);
      if (node.type === "hardBreak") parts.push("\n");
      if (node.content) {
        walk(node.content);
        if (["paragraph", "heading", "listItem"].includes(node.type)) parts.push("\n");
      }
    }
  };
  walk(doc.content);
  return parts.join("").replace(/\n{2,}/g, "\n").trim();
}

// HTML rendering (display only, never stored). Every text chunk is escaped;
// only allowlisted structure exists by construction after validation.
export function renderNarrativeHtml(doc: NarrativeDoc): string {
  return renderNodes(doc.content);
}

function renderNodes(nodes: NarrativeNode[] | undefined): string {
  if (!nodes) return "";
  return nodes.map(renderNode).join("");
}

function renderNode(node: NarrativeNode): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${renderNodes(node.content)}</p>`;
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2;
      return `<h${level}>${renderNodes(node.content)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${renderNodes(node.content)}</ul>`;
    case "orderedList":
      return `<ol>${renderNodes(node.content)}</ol>`;
    case "listItem":
      return `<li>${renderNodes(node.content)}</li>`;
    case "hardBreak":
      return "<br>";
    case "text": {
      let html = escapeHtml(node.text ?? "");
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") html = `<strong>${html}</strong>`;
        if (mark.type === "italic") html = `<em>${html}</em>`;
        if (mark.type === "link") {
          const href = escapeHtml(String(mark.attrs?.href ?? ""));
          html = `<a href="${href}" rel="noopener noreferrer" target="_blank">${html}</a>`;
        }
      }
      return html;
    }
    default:
      return "";
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function emptyNarrativeDoc(): NarrativeDoc {
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}

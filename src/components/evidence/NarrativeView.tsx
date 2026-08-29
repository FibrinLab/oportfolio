import type { ReactNode } from "react";
import type { NarrativeDoc, NarrativeNode } from "@/server/portfolio/narrativeDoc";

// Renders the restricted narrative document as React elements — no HTML
// string is ever built, so a decrypted document cannot inject markup. Only
// the allowlisted structure is rendered; unknown nodes are dropped.

export function NarrativeView({ doc }: { doc: NarrativeDoc | null | undefined }) {
  if (!doc || doc.type !== "doc") return null;
  return <>{renderNodes(doc.content)}</>;
}

function renderNodes(nodes: NarrativeNode[] | undefined): ReactNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node, index) => renderNode(node, index));
}

function renderNode(node: NarrativeNode, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{renderNodes(node.content)}</p>;
    case "heading":
      return node.attrs?.level === 3 ? (
        <h3 key={key}>{renderNodes(node.content)}</h3>
      ) : (
        <h2 key={key}>{renderNodes(node.content)}</h2>
      );
    case "bulletList":
      return <ul key={key}>{renderNodes(node.content)}</ul>;
    case "orderedList":
      return <ol key={key}>{renderNodes(node.content)}</ol>;
    case "listItem":
      return <li key={key}>{renderNodes(node.content)}</li>;
    case "hardBreak":
      return <br key={key} />;
    case "text": {
      let element: ReactNode = typeof node.text === "string" ? node.text : "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") element = <strong>{element}</strong>;
        if (mark.type === "italic") element = <em>{element}</em>;
        if (mark.type === "link") {
          const href = String(mark.attrs?.href ?? "");
          if (/^https?:\/\//i.test(href)) {
            element = (
              <a href={href} rel="noopener noreferrer" target="_blank">
                {element}
              </a>
            );
          }
        }
      }
      return <span key={key}>{element}</span>;
    }
    default:
      return null;
  }
}

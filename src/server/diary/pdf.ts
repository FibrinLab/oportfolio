import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import PDFDocument from "pdfkit";
import type { DiaryExportSnapshot } from "./export";

type RichNode = {
  type?: string;
  text?: string;
  attrs?: { href?: string; level?: number };
  content?: RichNode[];
};

const displayDate = (value: string | null) => {
  if (!value) return "Undated";
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

function nodeText(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(nodeText).join("");
}

function addTaggedText(
  doc: PDFKit.PDFDocument,
  parent: PDFKit.PDFStructureElement,
  tag: "H1" | "H2" | "H3" | "P" | "L" | "LI" | "Lbl" | "LBody",
  text: string,
  options: PDFKit.Mixins.TextOptions = {},
) {
  if (!text) return;
  parent.add(
    doc.struct(tag, {}, () => {
      doc.text(text.endsWith(" ") ? text : `${text} `, options);
    }),
  );
}

function renderRichNode(
  doc: PDFKit.PDFDocument,
  parent: PDFKit.PDFStructureElement,
  node: RichNode,
  depth = 0,
) {
  switch (node.type) {
    case "doc":
      for (const child of node.content ?? []) renderRichNode(doc, parent, child, depth);
      break;
    case "heading":
      doc.moveDown(0.35).font("Helvetica-Bold").fontSize(node.attrs?.level === 1 ? 16 : 13);
      addTaggedText(doc, parent, "H3", nodeText(node), { paragraphGap: 4 });
      doc.font("Helvetica").fontSize(10.5);
      break;
    case "bulletList":
    case "orderedList": {
      const list = doc.struct("L");
      parent.add(list);
      (node.content ?? []).forEach((item, index) => {
        const li = doc.struct("LI");
        list.add(li);
        const label = node.type === "orderedList" ? `${index + 1}.` : "•";
        addTaggedText(doc, li, "Lbl", label, { continued: true, indent: depth * 12 });
        addTaggedText(doc, li, "LBody", nodeText(item), { paragraphGap: 3, indent: 18 + depth * 12 });
      });
      list.end();
      break;
    }
    case "blockquote":
      doc.font("Helvetica-Oblique");
      addTaggedText(doc, parent, "P", nodeText(node), { indent: 18, paragraphGap: 5 });
      doc.font("Helvetica");
      break;
    case "codeBlock":
      doc.font("Courier").fontSize(9.5);
      addTaggedText(doc, parent, "P", nodeText(node), { indent: 12, paragraphGap: 5 });
      doc.font("Helvetica").fontSize(10.5);
      break;
    case "paragraph":
      addTaggedText(doc, parent, "P", nodeText(node), { paragraphGap: 6, lineGap: 1.5 });
      break;
    default: {
      const text = nodeText(node);
      if (text) addTaggedText(doc, parent, "P", text, { paragraphGap: 5 });
    }
  }
}

export async function renderDiaryPdfToFile(
  snapshot: DiaryExportSnapshot,
  outputPath: string,
): Promise<void> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    autoFirstPage: false,
    pdfVersion: "1.7",
    tagged: true,
    subset: "PDF/UA" as never,
    lang: "en-GB",
    displayTitle: true,
    info: {
      Title: `${snapshot.fellow.displayName} — Private diary`,
      Author: snapshot.fellow.displayName,
      Subject: "Private diary export",
      CreationDate: new Date(snapshot.snapshotAt),
    },
  });
  const output = createWriteStream(outputPath, { mode: 0o600 });
  doc.pipe(output);

  const root = doc.struct("Document");
  doc.addStructure(root);
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(24);
  addTaggedText(doc, root, "H1", "Private diary", { paragraphGap: 14 });
  doc.font("Helvetica").fontSize(12);
  addTaggedText(doc, root, "P", snapshot.fellow.displayName, { paragraphGap: 8 });
  if (snapshot.fellowship.programme !== "Personal diary") {
    addTaggedText(
      doc,
      root,
      "P",
      `${snapshot.fellowship.programme} — ${snapshot.fellowship.cohort}`,
      { paragraphGap: 4 },
    );
  }
  addTaggedText(
    doc,
    root,
    "P",
    `Diary dates: ${displayDate(snapshot.fellowship.startsOn)} to ${displayDate(snapshot.fellowship.endsOn)}`,
    { paragraphGap: 4 },
  );
  addTaggedText(
    doc,
    root,
    "P",
    `Exported ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(new Date(snapshot.snapshotAt))}`,
    { paragraphGap: 16 },
  );

  doc.font("Helvetica-Bold").fontSize(16);
  addTaggedText(doc, root, "H2", "Contents", { paragraphGap: 8 });
  doc.font("Helvetica").fontSize(10.5);
  if (snapshot.entries.length === 0) {
    addTaggedText(doc, root, "P", "No retained diary entries.");
  } else {
    for (const [index, entry] of snapshot.entries.entries()) {
      addTaggedText(
        doc,
        root,
        "P",
        `${index + 1}. ${displayDate(entry.activityDate)} — ${entry.title}${entry.archived ? " [Archived]" : ""}`,
        { paragraphGap: 3 },
      );
    }
  }

  for (const [index, entry] of snapshot.entries.entries()) {
    doc.addPage();
    doc.outline.addItem(`${index + 1}. ${entry.title}`);
    const section = doc.struct("Sect", { title: entry.title });
    root.add(section);
    doc.font("Helvetica-Bold").fontSize(17);
    addTaggedText(doc, section, "H2", entry.title, { paragraphGap: 6 });
    doc.font("Helvetica").fontSize(10.5);
    addTaggedText(
      doc,
      section,
      "P",
      [
        displayDate(entry.activityDate),
        entry.entryType?.label,
        entry.archived ? "Archived" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      { paragraphGap: 12 },
    );
    renderRichNode(doc, section, entry.body as RichNode);

    if (entry.objectives.length) {
      doc.moveDown(0.5).font("Helvetica-Bold").fontSize(12);
      addTaggedText(doc, section, "H3", "Optional curriculum links", { paragraphGap: 5 });
      doc.font("Helvetica").fontSize(10.5);
      for (const objective of entry.objectives) {
        addTaggedText(
          doc,
          section,
          "P",
          `${objective.code} — ${objective.title} (${objective.domainCode}: ${objective.domainTitle})`,
          { paragraphGap: 3 },
        );
      }
    }

    if (entry.links.length || entry.attachments.length) {
      doc.moveDown(0.5).font("Helvetica-Bold").fontSize(12);
      addTaggedText(doc, section, "H3", "Files and links", { paragraphGap: 5 });
      doc.font("Helvetica").fontSize(10.5);
      for (const link of entry.links) {
        addTaggedText(doc, section, "P", `${link.label ?? link.url}: ${link.url}`, {
          link: link.url,
          underline: true,
          paragraphGap: 3,
        });
      }
      for (const file of entry.attachments) {
        addTaggedText(
          doc,
          section,
          "P",
          `${file.displayName} (${file.mediaType}, ${file.sizeBytes} bytes)`,
          { paragraphGap: 3 },
        );
      }
    }
    section.end();
  }

  root.end();
  doc.end();
  await finished(output);
}

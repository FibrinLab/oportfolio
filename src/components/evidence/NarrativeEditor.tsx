"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";
import styles from "./NarrativeEditor.module.css";

// Restricted editor (spec/06): paragraphs, headings 2-3, lists, bold/italic,
// safe links. The server independently re-validates the document — this
// configuration is user experience, not the security boundary.

export function NarrativeEditor({
  initialDoc,
  onChange,
  labelledBy,
}: {
  initialDoc: unknown;
  onChange: (doc: unknown) => void;
  labelledBy: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https"],
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: (initialDoc as object) ?? undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: styles.prose ?? "",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getJSON());
    },
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  if (!editor) {
    return <div className={styles.editorShell} aria-busy="true" />;
  }

  const toolbarButton = (
    label: string,
    active: boolean,
    onClick: () => void,
    ariaLabel?: string,
  ) => (
    <button
      type="button"
      className={styles.toolButton}
      data-active={active}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.editorShell}>
      <div className={styles.toolbar} role="toolbar" aria-label="Text formatting">
        {toolbarButton("B", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold")}
        {toolbarButton("I", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic")}
        {toolbarButton("H2", editor.isActive("heading", { level: 2 }), () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(), "Heading level 2")}
        {toolbarButton("H3", editor.isActive("heading", { level: 3 }), () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run(), "Heading level 3")}
        {toolbarButton("• List", editor.isActive("bulletList"), () =>
          editor.chain().focus().toggleBulletList().run(), "Bulleted list")}
        {toolbarButton("1. List", editor.isActive("orderedList"), () =>
          editor.chain().focus().toggleOrderedList().run(), "Numbered list")}
        {toolbarButton("Link", editor.isActive("link"), () => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt("Link address (https://…)");
          if (url && /^https?:\/\//i.test(url.trim())) {
            editor.chain().focus().setLink({ href: url.trim() }).run();
          }
        }, "Insert link")}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

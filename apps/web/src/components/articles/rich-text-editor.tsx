"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

interface RichTextEditorProps {
  id: string;
  label: string;
  initialHtml: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({
  id,
  label,
  initialHtml,
  invalid,
  describedBy,
  onChange,
}: RichTextEditorProps) {
  const t = useTranslations("articles.editor.toolbar");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: "article-body min-h-64 px-4 py-3 outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            underline: current.isActive("underline"),
            strike: current.isActive("strike"),
            heading2: current.isActive("heading", { level: 2 }),
            heading3: current.isActive("heading", { level: 3 }),
            bulletList: current.isActive("bulletList"),
            orderedList: current.isActive("orderedList"),
            blockquote: current.isActive("blockquote"),
            code: current.isActive("code"),
            link: current.isActive("link"),
          }
        : null,
  });

  const setLink = () => {
    if (!editor) {
      return;
    }
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt(t("linkPrompt"), previous ?? "https://");
    if (href === null) {
      return;
    }
    if (href.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
    }
  };

  const buttons: {
    key: keyof NonNullable<typeof active> | "undo" | "redo";
    label: string;
    run: () => void;
  }[] = editor
    ? [
        { key: "bold", label: "B", run: () => editor.chain().focus().toggleBold().run() },
        { key: "italic", label: "I", run: () => editor.chain().focus().toggleItalic().run() },
        { key: "underline", label: "U", run: () => editor.chain().focus().toggleUnderline().run() },
        { key: "strike", label: "S", run: () => editor.chain().focus().toggleStrike().run() },
        {
          key: "heading2",
          label: "H2",
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          key: "heading3",
          label: "H3",
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          key: "bulletList",
          label: "*",
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          key: "orderedList",
          label: "1.",
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          key: "blockquote",
          label: '"',
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        { key: "code", label: "<>", run: () => editor.chain().focus().toggleCode().run() },
        { key: "link", label: "@", run: setLink },
        { key: "undo", label: "<-", run: () => editor.chain().focus().undo().run() },
        { key: "redo", label: "->", run: () => editor.chain().focus().redo().run() },
      ]
    : [];

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface/5 focus-within:border-primary",
        invalid ? "border-danger" : "border-line/20",
      )}
    >
      <div role="toolbar" className="flex flex-wrap gap-1 border-b border-line/10 p-2">
        {buttons.map((button) => {
          const pressed =
            button.key === "undo" || button.key === "redo"
              ? undefined
              : (active?.[button.key] ?? false);
          return (
            <button
              key={button.key}
              type="button"
              title={t(button.key)}
              aria-label={t(button.key)}
              aria-pressed={pressed}
              onClick={button.run}
              className={cn(
                "min-w-8 rounded-md border px-2 py-1 font-mono text-xs",
                pressed
                  ? "border-primary bg-primary text-on-primary"
                  : "border-line/20 hover:border-primary",
              )}
            >
              {button.label}
            </button>
          );
        })}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

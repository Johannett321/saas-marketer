import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

// tiptap-markdown augments editor.storage at runtime but ships no type for it
type MarkdownStorage = { markdown: { getMarkdown: () => string } };
const toMarkdown = (editor: Editor) =>
  (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";

/**
 * WYSIWYG editing over a markdown document. The card still stores markdown —
 * tiptap-markdown does the round-trip — so nothing downstream changes.
 */
export function ScriptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  const editor = useEditor({
    // the drawer renders on the server first; let the editor mount on the client
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose-script min-h-[18rem] px-5 py-4 outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(toMarkdown(editor)),
  });

  // keep the editor in sync when the AI replaces the script underneath it
  useEffect(() => {
    if (!editor) return;
    const current = toMarkdown(editor);
    if (value !== current) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="rounded-box border border-ink-200 bg-base-100">
        <div className="h-11 border-b border-ink-200 bg-ink-100/60" />
        <div className="min-h-[18rem] px-5 py-4 text-[13px] text-ink-400">Loading editor…</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-box border border-ink-200 bg-base-100 focus-within:border-brand-300">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-ink-200 bg-ink-100/60 px-2 py-1.5">
        <Tool
          editor={editor}
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </Tool>
        <Tool
          editor={editor}
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </Tool>

        <Divider />

        <Tool
          editor={editor}
          label="Section heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-3.5" />
        </Tool>
        <Tool
          editor={editor}
          label="Sub heading"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-3.5" />
        </Tool>

        <Divider />

        <Tool
          editor={editor}
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </Tool>
        <Tool
          editor={editor}
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </Tool>
        <Tool
          editor={editor}
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-3.5" />
        </Tool>

        <span className="ml-auto flex gap-0.5">
          <Tool
            editor={editor}
            label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo2 className="size-3.5" />
          </Tool>
          <Tool
            editor={editor}
            label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo2 className="size-3.5" />
          </Tool>
        </span>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  editor: Editor;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-md transition-colors disabled:opacity-35 ${
        active
          ? "bg-brand-100 text-brand-700"
          : "text-ink-500 hover:bg-ink-200 hover:text-ink-800"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-ink-300" />;
}

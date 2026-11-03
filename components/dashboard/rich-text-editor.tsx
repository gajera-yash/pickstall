"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Redo2, Underline, Undo2, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RICH_TEXT_MAX_CHARS, plainTextOf, safeHref, type RichDoc } from "@/lib/products/rich-text";
import { cn } from "@/lib/utils";

/**
 * Description editor (D-049): Tiptap with only what the store page can show (bold, italic,
 * underline, two heading sizes, lists, links). It hands back the editor's JSON; the server checks it
 * against the allow-list (lib/products/rich-text.ts) and nothing is ever stored as HTML.
 */
export function RichTextEditor({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: RichDoc;
  onChange: (doc: RichDoc) => void;
  error?: string | null;
}) {
  const labelId = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [chars, setChars] = useState(() => plainTextOf(value).length);

  const editor = useEditor({
    // Rendered on the client only, so the server HTML and the first client render match.
    immediatelyRender: false,
    // The toolbar shows which marks are on, so it re-renders with the editor.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        // No forced empty paragraph at the end: it would be saved as a blank line.
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          // The same rule the server uses: https or mailto only.
          isAllowedUri: (url) => safeHref(url) !== null,
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        "aria-describedby": error ? errorId : hintId,
        ...(error ? { "aria-invalid": "true" } : {}),
        class: "min-h-36 px-3 py-2.5 text-base text-ink outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      const doc = current.getJSON() as RichDoc;
      setChars(plainTextOf(doc).length);
      onChange(doc);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId} htmlFor={id}>
        {label}
      </Label>
      <div
        className={cn(
          "overflow-hidden rounded-md border bg-surface focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          error ? "border-danger" : "border-input",
        )}
      >
        <Toolbar editor={editor} />
        <EditorContent
          editor={editor}
          className={cn(
            "[&_.ProseMirror]:flex [&_.ProseMirror]:flex-col [&_.ProseMirror]:gap-2 [&_.ProseMirror]:break-words",
            "[&_h2]:font-display [&_h2]:text-h3 [&_h3]:font-display [&_h3]:text-h4",
            "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
            "[&_a]:text-blue [&_a]:underline [&_a]:underline-offset-4",
          )}
        />
      </div>
      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : (
        <FieldHint id={hintId} className={cn(chars > RICH_TEXT_MAX_CHARS && "text-danger")}>
          {chars}/{RICH_TEXT_MAX_CHARS}. Bold, italic, headings, lists and links.
        </FieldHint>
      )}
    </div>
  );
}

function ToolButton({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      // Keep focus and the text selection in the editor; otherwise a click moves the caret first.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(active && "bg-blue-soft text-blue")}
    >
      <Icon aria-hidden="true" className="size-4" />
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const off = !editor;
  const chain = () => editor?.chain().focus();
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-bg-subtle px-1.5 py-1">
      <ToolButton icon={Bold} label="Bold" active={editor?.isActive("bold")} disabled={off} onClick={() => chain()?.toggleBold().run()} />
      <ToolButton icon={Italic} label="Italic" active={editor?.isActive("italic")} disabled={off} onClick={() => chain()?.toggleItalic().run()} />
      <ToolButton icon={Underline} label="Underline" active={editor?.isActive("underline")} disabled={off} onClick={() => chain()?.toggleUnderline().run()} />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
      <ToolButton icon={Heading2} label="Heading" active={editor?.isActive("heading", { level: 2 })} disabled={off} onClick={() => chain()?.toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label="Small heading" active={editor?.isActive("heading", { level: 3 })} disabled={off} onClick={() => chain()?.toggleHeading({ level: 3 }).run()} />
      <ToolButton icon={List} label="Bullet list" active={editor?.isActive("bulletList")} disabled={off} onClick={() => chain()?.toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label="Numbered list" active={editor?.isActive("orderedList")} disabled={off} onClick={() => chain()?.toggleOrderedList().run()} />
      <LinkButton editor={editor} />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
      <ToolButton icon={Undo2} label="Undo" disabled={off || !editor.can().undo()} onClick={() => chain()?.undo().run()} />
      <ToolButton icon={Redo2} label="Redo" disabled={off || !editor.can().redo()} onClick={() => chain()?.redo().run()} />
    </div>
  );
}

/** Add, change or remove a link on the selected text, checked with the same https/mailto rule. */
function LinkButton({ editor }: { editor: Editor | null }) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const active = editor?.isActive("link") ?? false;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setUrl((editor?.getAttributes("link").href as string | undefined) ?? "");
      setProblem(null);
    }
  };

  const apply = () => {
    if (!editor) return;
    const raw = url.trim();
    // A bare address ("example.com") gets https:// in front; anything else must already be safe.
    const href = safeHref(raw) ?? (raw.includes(":") ? null : safeHref(`https://${raw}`));
    if (!href) {
      setProblem("Use a full link that starts with https://");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setOpen(false);
  };

  const remove = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" aria-pressed={active} disabled={!editor} className={cn(active && "bg-blue-soft text-blue")}>
          <Link2 aria-hidden="true" className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3">
        <Label htmlFor={inputId}>Link address</Label>
        <Input
          id={inputId}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              // Enter applies the link instead of submitting the product form.
              event.preventDefault();
              apply();
            }
          }}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${inputId}-error` : undefined}
        />
        {problem && <FieldError id={`${inputId}-error`}>{problem}</FieldError>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={apply}>
            Apply
          </Button>
          {active && (
            <Button type="button" size="sm" variant="ghost" onClick={remove}>
              Remove link
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

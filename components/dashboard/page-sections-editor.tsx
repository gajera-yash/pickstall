"use client";

import { ArrowDown, ArrowUp, ImageIcon, LayoutList, Link2, MessageSquareQuote, Plus, ShoppingBag, Trash2, Type, Video, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useDesignDraft, useSaver } from "@/components/dashboard/design-draft";
import { Field } from "@/components/dashboard/editor-fields";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { watchUrlFor } from "@/lib/courses/video-links";
import { savePageBlocksAction } from "@/lib/page-blocks/actions";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { ADDABLE_BLOCKS, BLOCK_LABELS, BLOCK_LIMITS, DEFAULT_IMAGE_GRID, DEFAULT_SECTION_STYLE, PAGE_BLOCKS_MAX, imagesOf, newBlockId, pageBlocksInput, videosOf, type BlockImage, type ImageGrid, type PageBlock, type PageBlockType, type SectionStyle, type VideoColumns } from "@/lib/page-blocks/rules";

/** A section while it is being edited: videos are the pasted links, every text a plain string. */
type Look = { style?: SectionStyle };
type Draft =
  | { id: string; type: "products" }
  | ({ id: string; type: "text"; heading: string; body: string } & Look)
  | ({ id: string; type: "image"; images: BlockImage[]; grid?: ImageGrid } & Look)
  | ({ id: string; type: "video"; links: string[]; columns?: VideoColumns } & Look)
  | ({ id: string; type: "links"; links: { label: string; url: string }[] } & Look)
  | ({ id: string; type: "testimonial"; quote: string; name: string } & Look);

const ICONS: Record<PageBlockType, LucideIcon> = { products: ShoppingBag, text: Type, image: ImageIcon, video: Video, links: Link2, testimonial: MessageSquareQuote };

function toDraft(block: PageBlock): Draft {
  switch (block.type) {
    case "text":
      return { id: block.id, type: "text", heading: block.heading ?? "", body: block.body, style: block.style };
    case "image":
      return { id: block.id, type: "image", images: imagesOf(block), grid: block.grid, style: block.style };
    case "video":
      return { id: block.id, type: "video", links: videosOf(block).map(watchUrlFor), columns: block.columns, style: block.style };
    case "testimonial":
      return { id: block.id, type: "testimonial", quote: block.quote, name: block.name ?? "", style: block.style };
    default:
      return block;
  }
}

function empty(type: Exclude<PageBlockType, "products">): Draft {
  const id = newBlockId();
  if (type === "text") return { id, type, heading: "", body: "" };
  if (type === "image") return { id, type, images: [{ url: "", alt: "" }] };
  if (type === "video") return { id, type, links: [""] };
  if (type === "links") return { id, type, links: [{ label: "", url: "" }] };
  return { id, type, quote: "", name: "" };
}

/**
 * Store page sections (D-101) on My Store's Page design tab: add text, image, video, links and
 * testimonials, move them above or below the Products section with the arrow buttons, and save.
 * The server checks everything again; the live preview updates after saving.
 */
/** `saved` is what is saved now when it differs from `initial` (a template was applied, D-130). */
export function PageSectionsEditor({ initial, saved }: { initial: PageBlock[]; saved?: PageBlock[] }) {
  const designDraft = useDesignDraft();
  const patchDraft = designDraft?.patch;
  const [drafts, setDrafts] = useState<Draft[]>(() => (initial.length > 0 ? initial.map(toDraft) : [{ id: newBlockId(), type: "products" }]));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(saved === undefined ? drafts : saved.map(toDraft)));
  const [problem, setProblem] = useState<{ text: string; index: number | null } | null>(null);
  const sections = drafts.filter((draft) => draft.type !== "products").length;
  const dirty = JSON.stringify(drafts) !== savedJson;

  // The live preview shows the sections as they are edited, once they are complete enough to draw.
  useEffect(() => {
    const parsed = pageBlocksInput.safeParse(drafts);
    if (parsed.success) patchDraft?.({ blocks: parsed.data });
  }, [drafts, patchDraft]);

  // Saved with the Store design page's one Save button (D-125); the server checks everything again.
  useSaver("sections", dirty, async () => {
    setProblem(null);
    const result = await savePageBlocksAction(drafts);
    if (!result.ok) {
      const index = result.field?.startsWith("block-") ? Number(result.field.slice(6)) : null;
      setProblem({ text: result.error, index: Number.isInteger(index) ? index : null });
      return false;
    }
    const next = result.data.blocks.map(toDraft);
    setDrafts(next);
    setSavedJson(JSON.stringify(next));
    designDraft?.markSaved({ blocks: result.data.blocks });
    return true;
  });

  const update = (index: number, next: Draft) => {
    setDrafts((current) => current.map((draft, i) => (i === index ? next : draft)));
  };
  const move = (index: number, step: -1 | 1) => {
    setDrafts((current) => {
      const target = index + step;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };
  const remove = (index: number) => {
    setDrafts((current) => current.filter((_, i) => i !== index));
  };
  const add = (type: Exclude<PageBlockType, "products">) => {
    setDrafts((current) => [...current, empty(type)]);
  };

  return (
    <section aria-labelledby="page-sections" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="page-sections" className="flex items-center gap-2 font-display text-h3">
            <LayoutList aria-hidden="true" className="size-4 text-blue" />
            Page sections
          </h2>
          <p className="text-sm text-mute">Add text, images, videos, links or testimonials around your products. Use the arrows to change the order.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="sm" disabled={sections >= PAGE_BLOCKS_MAX}>
              <Plus aria-hidden="true" className="size-4" />
              Add section
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {ADDABLE_BLOCKS.map((type) => {
              const Icon = ICONS[type];
              return (
                <DropdownMenuItem key={type} onSelect={() => add(type)}>
                  <Icon aria-hidden="true" />
                  {BLOCK_LABELS[type]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ol className="flex flex-col gap-3">
        {drafts.map((draft, index) => {
          const Icon = ICONS[draft.type];
          const label = BLOCK_LABELS[draft.type];
          return (
            <li key={draft.id} className={`flex flex-col gap-3 rounded-lg border p-4 ${draft.type === "products" ? "border-blue bg-blue-soft" : "border-line bg-surface"}`}>
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 text-blue" />
                <span className="flex-1 font-semibold">{draft.type === "products" ? "Your products" : label}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp aria-hidden="true" className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${label} down`} disabled={index === drafts.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDown aria-hidden="true" className="size-4" />
                </Button>
                {draft.type !== "products" && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={() => remove(index)}>
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                )}
              </div>
              <DraftFields draft={draft} index={index} onChange={(next) => update(index, next)} />
              {draft.type !== "products" && <SectionLook id={`block-${index}`} value={draft.style ?? DEFAULT_SECTION_STYLE} onChange={(style) => update(index, { ...draft, style })} />}
              {problem?.index === index && (
                <Alert variant="error">
                  <AlertDescription>{problem.text}</AlertDescription>
                </Alert>
              )}
            </li>
          );
        })}
      </ol>

      {problem && problem.index === null && (
        <Alert variant="error">
          <AlertDescription>{problem.text}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

/** How a section looks (D-123): its box, alignment and the space around it. */
function SectionLook({ id, value, onChange }: { id: string; value: SectionStyle; onChange: (style: SectionStyle) => void }) {
  return (
    <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
      <Field id={`${id}-box`} label="Box">
        <ChoiceSelect id={`${id}-box`} size="sm" value={value.box} onValueChange={(box) => onChange({ ...value, box: box as SectionStyle["box"] })} options={[{ value: "card", label: "Card" }, { value: "outline", label: "Outline" }, { value: "none", label: "None" }]} />
      </Field>
      <Field id={`${id}-align`} label="Align">
        <ChoiceSelect id={`${id}-align`} size="sm" value={value.align} onValueChange={(align) => onChange({ ...value, align: align as SectionStyle["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }]} />
      </Field>
      <Field id={`${id}-spacing`} label="Space around">
        <ChoiceSelect id={`${id}-spacing`} size="sm" value={value.spacing} onValueChange={(spacing) => onChange({ ...value, spacing: spacing as SectionStyle["spacing"] })} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "roomy", label: "Roomy" }]} />
      </Field>
    </div>
  );
}

function DraftFields({ draft, index, onChange }: { draft: Draft; index: number; onChange: (next: Draft) => void }) {
  const key = `block-${index}`;
  switch (draft.type) {
    case "products":
      return <p className="text-sm text-mute">Your published products show here. Move sections above or below them.</p>;
    case "text":
      return (
        <>
          <Field id={`${key}-heading`} label="Heading (optional)">
            <Input id={`${key}-heading`} value={draft.heading} maxLength={BLOCK_LIMITS.heading} onChange={(event) => onChange({ ...draft, heading: event.target.value })} />
          </Field>
          <Field id={`${key}-body`} label="Text" hint={`${draft.body.length}/${BLOCK_LIMITS.body}. Links starting with https:// become clickable.`}>
            <Textarea id={`${key}-body`} value={draft.body} rows={4} maxLength={BLOCK_LIMITS.body} onChange={(event) => onChange({ ...draft, body: event.target.value })} />
          </Field>
        </>
      );
    case "image":
      return <ImageFields draft={draft} id={key} onChange={onChange} />;
    case "video":
      return (
        <div className="flex flex-col gap-3">
          {draft.links.map((link, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field id={`${key}-link-${i}`} label={draft.links.length > 1 ? `Video ${i + 1}: YouTube or Vimeo link` : "YouTube or Vimeo link"} hint={i === 0 ? "Paste the link of the video page." : undefined}>
                  <Input id={`${key}-link-${i}`} value={link} inputMode="url" placeholder="https://www.youtube.com/watch?v=..." onChange={(event) => onChange({ ...draft, links: draft.links.map((item, j) => (j === i ? event.target.value : item)) })} />
                </Field>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove video ${i + 1}`} disabled={draft.links.length === 1} onClick={() => onChange({ ...draft, links: draft.links.filter((_, j) => j !== i) })}>
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" disabled={draft.links.length >= BLOCK_LIMITS.videosMax} onClick={() => onChange({ ...draft, links: [...draft.links, ""] })}>
              <Plus aria-hidden="true" className="size-4" />
              Add a video
            </Button>
            {draft.links.length > 1 && (
              <div className="w-44">
                <Field id={`${key}-columns`} label="Layout">
                  <ChoiceSelect id={`${key}-columns`} size="sm" value={String(draft.columns ?? 1)} onValueChange={(value) => onChange({ ...draft, columns: value === "2" ? 2 : 1 })} options={[{ value: "1", label: "One per row" }, { value: "2", label: "Two per row" }]} />
                </Field>
              </div>
            )}
          </div>
        </div>
      );
    case "links":
      return (
        <div className="flex flex-col gap-3">
          {draft.links.map((link, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
              <Field id={`${key}-label-${i}`} label="Button text">
                <Input id={`${key}-label-${i}`} value={link.label} maxLength={BLOCK_LIMITS.linkLabel} onChange={(event) => onChange({ ...draft, links: draft.links.map((item, j) => (j === i ? { ...item, label: event.target.value } : item)) })} />
              </Field>
              <Field id={`${key}-url-${i}`} label="Link">
                <Input id={`${key}-url-${i}`} value={link.url} inputMode="url" placeholder="https://" onChange={(event) => onChange({ ...draft, links: draft.links.map((item, j) => (j === i ? { ...item, url: event.target.value } : item)) })} />
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${i + 1}`} disabled={draft.links.length === 1} onClick={() => onChange({ ...draft, links: draft.links.filter((_, j) => j !== i) })}>
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" className="self-start" disabled={draft.links.length >= BLOCK_LIMITS.linksMax} onClick={() => onChange({ ...draft, links: [...draft.links, { label: "", url: "" }] })}>
            <Plus aria-hidden="true" className="size-4" />
            Add a link
          </Button>
        </div>
      );
    case "testimonial":
      return (
        <>
          <Field id={`${key}-quote`} label="Quote">
            <Textarea id={`${key}-quote`} value={draft.quote} rows={3} maxLength={BLOCK_LIMITS.quote} onChange={(event) => onChange({ ...draft, quote: event.target.value })} />
          </Field>
          <Field id={`${key}-name`} label="Name (optional)">
            <Input id={`${key}-name`} value={draft.name} maxLength={BLOCK_LIMITS.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
          </Field>
        </>
      );
  }
}

/** Several pictures in one Image section, and the grid they sit in (columns, shape, gap). */
function ImageFields({ draft, id, onChange }: { draft: Extract<Draft, { type: "image" }>; id: string; onChange: (next: Draft) => void }) {
  const grid = draft.grid ?? DEFAULT_IMAGE_GRID;
  const setImage = (i: number, patch: Partial<BlockImage>) => onChange({ ...draft, images: draft.images.map((image, j) => (j === i ? { ...image, ...patch } : image)) });
  const setGrid = (patch: Partial<ImageGrid>) => onChange({ ...draft, grid: { ...grid, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <ol className="grid gap-4 sm:grid-cols-2">
        {draft.images.map((image, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-md border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Image {i + 1}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove image ${i + 1}`} disabled={draft.images.length === 1} onClick={() => onChange({ ...draft, images: draft.images.filter((_, j) => j !== i) })}>
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <ImageUploader id={`${id}-image-${i}`} label={`Image ${i + 1}`} kind="cover" shape="wide" value={image.url} onChange={(url) => setImage(i, { url })} hint="JPG, PNG, WebP or GIF, up to 4 MB." />
            <Field id={`${id}-alt-${i}`} label="Description for screen readers (optional)">
              <Input id={`${id}-alt-${i}`} value={image.alt} maxLength={BLOCK_LIMITS.alt} onChange={(event) => setImage(i, { alt: event.target.value })} />
            </Field>
          </li>
        ))}
      </ol>
      <Button type="button" variant="ghost" size="sm" className="self-start" disabled={draft.images.length >= BLOCK_LIMITS.imagesMax} onClick={() => onChange({ ...draft, images: [...draft.images, { url: "", alt: "" }] })}>
        <Plus aria-hidden="true" className="size-4" />
        Add an image
      </Button>
      {draft.images.length > 1 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-columns`} label="Columns" hint="Phones show up to 2.">
            <ChoiceSelect id={`${id}-columns`} size="sm" value={String(grid.columns)} onValueChange={(value) => setGrid({ columns: Number(value) as ImageGrid["columns"] })} options={[{ value: "1", label: "1 column" }, { value: "2", label: "2 columns" }, { value: "3", label: "3 columns" }, { value: "4", label: "4 columns" }]} />
          </Field>
          <Field id={`${id}-ratio`} label="Image shape">
            <ChoiceSelect id={`${id}-ratio`} size="sm" value={grid.ratio} onValueChange={(ratio) => setGrid({ ratio: ratio as ImageGrid["ratio"] })} options={[{ value: "original", label: "Original" }, { value: "square", label: "Square" }, { value: "landscape", label: "Wide (16:9)" }, { value: "portrait", label: "Tall (4:5)" }]} />
          </Field>
          <Field id={`${id}-gap`} label="Gap">
            <ChoiceSelect id={`${id}-gap`} size="sm" value={grid.gap} onValueChange={(gap) => setGrid({ gap: gap as ImageGrid["gap"] })} options={[{ value: "small", label: "Small" }, { value: "normal", label: "Normal" }, { value: "large", label: "Large" }]} />
          </Field>
        </div>
      )}
    </div>
  );
}

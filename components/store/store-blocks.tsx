import { ExternalLink, Quote } from "lucide-react";
import type { CSSProperties } from "react";

import { borderColor, buttonStyle, cardStyle, type StoreTheme } from "@/components/store/store-theme";
import { embedUrlFor } from "@/lib/courses/video-links";
import { safeImageSrc } from "@/lib/media/media";
import { DEFAULT_IMAGE_GRID, DEFAULT_SECTION_STYLE, imagesOf, videosOf, type ImageGrid, type PageBlock, type SectionStyle } from "@/lib/page-blocks/rules";
import { cn } from "@/lib/utils";

// Store page sections (D-101), drawn in the store's theme: its card style, colors, display font and
// corner radius. Creator text is plain text (React escapes it); links are https; the video player
// URL is rebuilt from the checked id; images are uploads or https.

const HTTPS_LINK = /(https:\/\/[^\s<]+)/g;

/** Plain text with its https links made clickable and line breaks kept. */
function Linked({ text, accent }: { text: string; accent: string }) {
  const parts = text.split(HTTPS_LINK);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all underline underline-offset-4" style={{ color: accent }}>
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

/** A section's box (D-123): the theme's card, just its outline, or nothing around the content. */
function boxStyle(theme: StoreTheme, box: SectionStyle["box"]): CSSProperties {
  if (box === "card") return cardStyle(theme);
  const radius = theme.preset.radiusPx;
  return box === "outline" ? { borderRadius: radius, border: `1px solid ${borderColor(theme.preset)}` } : { borderRadius: radius };
}

// Fixed class strings so Tailwind keeps them. Phones show at most two columns.
const IMAGE_COLUMN_CLASS: Record<ImageGrid["columns"], string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" };
const IMAGE_GAP_CLASS: Record<ImageGrid["gap"], string> = { small: "gap-1", normal: "gap-3", large: "gap-5" };
const IMAGE_RATIO_CLASS: Record<ImageGrid["ratio"], string> = { original: "", square: "aspect-square", landscape: "aspect-video", portrait: "aspect-[4/5]" };

function Block({ block, theme }: { block: PageBlock; theme: StoreTheme }) {
  const { preset } = theme;
  const look = ("style" in block && block.style) || DEFAULT_SECTION_STYLE;
  const surface = boxStyle(theme, look.box);
  const center = look.align === "center";
  // Without a box the text needs no inner padding on the sides.
  const pad = look.box === "none" ? "py-2" : "p-5";
  switch (block.type) {
    case "text":
      return (
        <section className={cn("flex flex-col gap-2", pad, center && "items-center text-center")} style={surface}>
          {block.heading && (
            <h2 className="font-display text-h3 break-words" style={{ fontWeight: preset.displayWeight }}>
              {block.heading}
            </h2>
          )}
          <p className="break-words whitespace-pre-line" style={{ color: preset.muted }}>
            <Linked text={block.body} accent={theme.accent} />
          </p>
        </section>
      );
    case "image": {
      const images = imagesOf(block).flatMap((image) => {
        const src = safeImageSrc(image.url);
        return src ? [{ src, alt: image.alt }] : [];
      });
      if (images.length === 0) return null;
      const grid = block.grid ?? DEFAULT_IMAGE_GRID;
      // One picture fills the section; several sit in the creator's grid, each rounded like the theme.
      const columns = images.length === 1 ? "grid-cols-1" : IMAGE_COLUMN_CLASS[grid.columns];
      const inner = look.box === "none" ? "" : images.length > 1 ? "p-3" : "";
      const itemRadius = images.length > 1 || look.box === "none" ? Math.max(0, preset.radiusPx - (inner ? 6 : 0)) : 0;
      return (
        <figure className={cn("grid overflow-hidden", columns, IMAGE_GAP_CLASS[grid.gap], inner)} style={surface}>
          {images.map((image, index) => (
            // An upload or the creator's https link on any host, so next/image (fixed hosts) cannot load it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={image.src}
              alt={image.alt}
              referrerPolicy="no-referrer"
              loading="lazy"
              className={cn("w-full object-cover", IMAGE_RATIO_CLASS[grid.ratio], grid.ratio === "original" && images.length > 1 && "h-full")}
              style={{ borderRadius: itemRadius }}
            />
          ))}
        </figure>
      );
    }
    case "video": {
      const videos = videosOf(block);
      if (videos.length === 0) return null;
      const two = videos.length > 1 && block.columns === 2;
      const frame = (video: (typeof videos)[number], index: number) => (
        <iframe
          key={index}
          src={embedUrlFor(video)}
          title={videos.length > 1 ? `Video ${index + 1}` : "Video"}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className="aspect-video w-full border-0"
          style={videos.length > 1 ? { borderRadius: Math.max(0, preset.radiusPx - 6) } : undefined}
        />
      );
      if (videos.length === 1) {
        return (
          <div className="overflow-hidden" style={surface}>
            {frame(videos[0]!, 0)}
          </div>
        );
      }
      return (
        <div className={cn("grid gap-3 overflow-hidden", two && "sm:grid-cols-2", look.box !== "none" && "p-3")} style={surface}>
          {videos.map(frame)}
        </div>
      );
    }
    case "links":
      return (
        <nav aria-label="Links" className={cn("flex flex-col gap-3", center && "items-center")}>
          {block.links.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className={cn("flex min-h-12 items-center justify-center gap-2 px-5 text-center text-button break-words", center && "w-full max-w-md")}
              style={buttonStyle(theme)}
            >
              {link.label}
              <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            </a>
          ))}
        </nav>
      );
    case "testimonial":
      return (
        <figure className={cn("flex flex-col gap-3", pad, center && "items-center text-center")} style={surface}>
          <Quote aria-hidden="true" className="size-6" style={{ color: theme.accent }} />
          <blockquote className="break-words whitespace-pre-line">{block.quote}</blockquote>
          {block.name && (
            <figcaption className="text-sm font-semibold" style={{ color: preset.muted }}>
              {block.name}
            </figcaption>
          )}
        </figure>
      );
    default:
      return null;
  }
}

/** A run of sections (the ones above or below the products). Nothing when empty. */
export function StoreBlocks({ blocks, theme, className = "" }: { blocks: PageBlock[]; theme: StoreTheme; className?: string }) {
  if (blocks.length === 0) return null;
  return (
    <div className={`flex w-full flex-col gap-4 ${className}`}>
      {blocks.map((block) => {
        const spacing = ("style" in block && block.style?.spacing) || "normal";
        return (
          <div key={block.id} className={spacing === "roomy" ? "py-6" : spacing === "compact" ? "-my-1" : undefined}>
            <Block block={block} theme={theme} />
          </div>
        );
      })}
    </div>
  );
}

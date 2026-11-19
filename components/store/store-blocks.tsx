import { ExternalLink, Quote } from "lucide-react";

import { cardStyle, type StoreTheme } from "@/components/store/store-theme";
import { embedUrlFor } from "@/lib/courses/video-links";
import { safeImageSrc } from "@/lib/media/media";
import type { PageBlock } from "@/lib/page-blocks/rules";

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

function Block({ block, theme }: { block: PageBlock; theme: StoreTheme }) {
  const { preset } = theme;
  const radius = Math.min(preset.radiusPx, 12);
  switch (block.type) {
    case "text":
      return (
        <section className="flex flex-col gap-2 p-5" style={cardStyle(theme)}>
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
      const src = safeImageSrc(block.url);
      if (!src) return null;
      return (
        <figure className="overflow-hidden" style={cardStyle(theme)}>
          {/* An upload or the creator's https link on any host, so next/image (fixed hosts) cannot load it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={block.alt} referrerPolicy="no-referrer" loading="lazy" className="w-full object-cover" />
        </figure>
      );
    }
    case "video":
      return (
        <div className="overflow-hidden" style={cardStyle(theme)}>
          <iframe
            src={embedUrlFor(block.video)}
            title="Video"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            className="aspect-video w-full border-0"
          />
        </div>
      );
    case "links":
      return (
        <nav aria-label="Links" className="flex flex-col gap-3">
          {block.links.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="flex min-h-12 items-center justify-center gap-2 px-5 text-center text-button break-words"
              style={{ background: theme.accent, color: theme.onAccent, borderRadius: radius }}
            >
              {link.label}
              <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            </a>
          ))}
        </nav>
      );
    case "testimonial":
      return (
        <figure className="flex flex-col gap-3 p-5" style={cardStyle(theme)}>
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
      {blocks.map((block) => (
        <Block key={block.id} block={block} theme={theme} />
      ))}
    </div>
  );
}

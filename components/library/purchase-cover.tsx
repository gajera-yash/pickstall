import { CalendarCheck, Download, PlayCircle } from "lucide-react";

import { safeImageSrc } from "@/lib/media/media";
import { cn } from "@/lib/utils";

type Kind = "digital" | "course" | "coaching";

// Soft brand tints for purchases without a cover image. Picked from the title, so a product keeps
// the same look everywhere. Tokens only (DESIGN.md 0.1).
const TINTS = [
  "bg-blue-soft text-blue",
  "bg-violet-soft text-violet",
  "bg-mint-soft text-mint",
  "bg-yellow-soft text-warning",
  "bg-danger-soft text-danger",
] as const;

const ICONS = { digital: Download, course: PlayCircle, coaching: CalendarCheck } as const;

function tintOf(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length] as string;
}

/**
 * A purchase's cover (decorative: the title is always next to it). The creator's image when there is
 * one, else a calm tinted panel with the product type's icon and soft shapes.
 */
export function PurchaseCover({ coverUrl, title, kind, className, iconClassName }: { coverUrl: string | null; title: string; kind: Kind; className?: string; iconClassName?: string }) {
  const cover = safeImageSrc(coverUrl);
  const Icon = ICONS[kind];
  return (
    <span aria-hidden="true" className={cn("relative isolate flex items-center justify-center overflow-hidden", cover ? "bg-bg-subtle" : tintOf(title), className)}>
      {cover ? (
        // The creator's own upload or https link, so next/image's fixed remote hosts cannot be used.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover transition-transform duration-(--dur-slow) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
      ) : (
        <>
          <span className="absolute -top-10 -right-8 -z-10 size-32 rounded-full bg-surface/50" />
          <span className="absolute -bottom-12 -left-6 -z-10 size-28 rounded-full bg-surface/35" />
          <span className="flex size-14 items-center justify-center rounded-full bg-surface/80 shadow-sm">
            <Icon className={cn("size-7", iconClassName)} />
          </span>
        </>
      )}
    </span>
  );
}

/** The creator's small round photo (or their initial) and name, with an optional word before it ("by"). */
export function StoreChip({ name, avatarUrl, prefix, className }: { name: string; avatarUrl: string | null; prefix?: string; className?: string }) {
  const src = safeImageSrc(avatarUrl);
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-soft text-xs font-bold text-blue">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" />
        ) : (
          name.trim().charAt(0).toUpperCase() || "P"
        )}
      </span>
      <span className="truncate text-sm text-mute">
        {prefix ? `${prefix} ` : ""}
        {name}
      </span>
    </span>
  );
}

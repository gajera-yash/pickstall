import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Layout primitives shared by the landing sections (D-039). Server components, tokens only.

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

/** Small sentence-case label above a section title (DESIGN.md 15: no all-caps eyebrows). */
export function Eyebrow({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface py-1 pr-3 pl-2 text-sm font-semibold text-ink">
      {Icon && (
        <span className="flex size-6 items-center justify-center rounded-full bg-blue-soft">
          <Icon aria-hidden="true" className="size-3.5 text-blue" />
        </span>
      )}
      {children}
    </p>
  );
}

/** Section heading: eyebrow, a two-tone title (the second part muted) and an optional lead. */
export function SectionHeading({
  id,
  eyebrow,
  icon,
  title,
  muted,
  children,
  center,
  className,
}: {
  id: string;
  eyebrow: string;
  icon?: LucideIcon;
  title: ReactNode;
  muted?: ReactNode;
  children?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-4", center && "mx-auto items-center text-center [&>p:first-child]:self-center", className)}>
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h2 id={id} className="text-display-l text-balance">
        {title}
        {muted && <span className="text-mute"> {muted}</span>}
      </h2>
      {children && <p className="text-body-l text-mute text-pretty">{children}</p>}
    </div>
  );
}

/**
 * A product window: a slim top bar with an address pill, then the content. Used to frame the
 * example screens so they read as the real app, with the "Example" label always visible.
 */
export function Frame({
  address,
  label = "Example",
  className,
  bodyClassName,
  children,
}: {
  address: string;
  label?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-line bg-surface shadow-popover", className)}>
      <div className="flex items-center gap-3 border-b border-line bg-bg-subtle px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-full border border-line bg-surface px-3 py-1 text-center text-xs text-mute">{address}</span>
        <Badge variant="example">{label}</Badge>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/** A check-style bullet list used next to the showcases. */
export function PointList({ items }: { items: readonly { icon: LucideIcon; title: string; body: string }[] }) {
  return (
    <ul className="flex flex-col gap-5">
      {items.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface">
            <Icon aria-hidden="true" className="size-5 text-blue" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-semibold">{title}</span>
            <span className="text-sm text-mute">{body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

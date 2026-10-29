import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

// DESIGN.md 9.12: centered, 32px icon in a blue-soft circle, H3 title, one sentence, one action.
function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-5 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-blue-soft text-blue">
        <Icon aria-hidden="true" className="size-8" />
      </span>
      <h3 className="font-display text-h3">{title}</h3>
      <p className="max-w-sm text-sm text-mute">{children}</p>
      {action}
    </div>
  )
}

export { EmptyState }

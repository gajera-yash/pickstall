import { cn } from "@/lib/utils";

// Flat illustrations for the marketing landing (DESIGN.md 7): the stall awning with its scalloped
// edge. Palette tokens only, 2px ink outlines, decorative (aria-hidden).

const STRIPES = 8;
const WIDTH = 400;
const STRIPE = WIDTH / STRIPES;
const RADIUS = STRIPE / 2;
const TOP = 40;

/** Awning outline: a band across the top, then one half-circle scallop per stripe, right to left. */
function awningPath(): string {
  let d = `M1 1 H${WIDTH - 1} V${TOP}`;
  for (let i = STRIPES - 1; i >= 0; i--) {
    const x = Math.max(1, i * STRIPE);
    // Moving right to left with the clockwise flag makes each arc bulge downwards.
    d += ` A${RADIUS} ${RADIUS} 0 0 1 ${x} ${TOP}`;
  }
  return `${d} Z`;
}

const PATH = awningPath();

/** The striped stall awning. Stretches to its container's width. */
export function Awning({ id, className }: { id: string; className?: string }) {
  const height = TOP + RADIUS + 2;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" aria-hidden="true" className={cn("block w-full", className)}>
      <defs>
        <clipPath id={id}>
          <path d={PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {Array.from({ length: STRIPES }, (_, i) => (
          <rect key={i} x={i * STRIPE} y={0} width={STRIPE} height={height} className={i % 2 === 0 ? "fill-yellow" : "fill-surface"} />
        ))}
      </g>
      <path d={PATH} className="fill-none stroke-border-strong" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A row of small half circles, used as the torn edge of receipts and coupons. */
export function ReceiptEdge({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-2 w-full bg-[radial-gradient(circle_at_6px_0,transparent_5px,var(--surface)_5.5px)] bg-size-[12px_8px] bg-repeat-x", className)}
    />
  );
}

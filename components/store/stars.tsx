import { Star } from "lucide-react";

// Star rating display (D-106). Filled stars use the given color (the store accent, or the brand
// warning token in the dashboard); the label reads the rating out for screen readers.

export function Stars({ rating, size = "size-4", color = "var(--warning)" }: { rating: number; size?: string; color?: string }) {
  const rounded = Math.round(rating);
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} aria-hidden="true" className={size} style={{ color: value <= rounded ? color : "var(--line)", fill: value <= rounded ? color : "transparent" }} />
      ))}
    </span>
  );
}

/** "★ 4.8 (23)" for cards; nothing without reviews. */
export function RatingBadge({ average, count, color, mutedColor }: { average: number; count: number; color?: string; mutedColor?: string }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold">
      <Stars rating={average} size="size-3.5" color={color} />
      <span>{average.toFixed(1)}</span>
      <span style={{ color: mutedColor }}>({count.toLocaleString("en")})</span>
    </span>
  );
}

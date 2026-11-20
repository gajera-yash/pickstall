"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveReviewAction } from "@/lib/reviews/actions";
import { REVIEW_TEXT_MAX } from "@/lib/reviews/rules";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"] as const;

/**
 * "Rate this product" in the buyer's library (D-106): 1-5 stars as a radio group (keyboard
 * friendly) and an optional review. It shows on the product page at once; saving again updates it.
 */
export function ReviewForm({ orderId, initial }: { orderId: string; initial: { rating: number; text: string | null } | null }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(initial?.text ?? "");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const shown = hover || rating;

  const save = () =>
    start(async () => {
      const result = await saveReviewAction(orderId, { rating, text });
      setMessage(result.ok ? { kind: "success", text: initial ? "Your review is updated." : "Thank you! Your review is on the product page." } : { kind: "error", text: result.error });
    });

  return (
    <section aria-labelledby="review-title" className="flex flex-col gap-3 border-t border-line pt-5">
      <h3 id="review-title" className="font-display text-h4">
        {initial ? "Your review" : "Rate this product"}
      </h3>
      <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHover(value)}
            className="flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none"
          >
            <Star aria-hidden="true" className="size-7" style={{ color: value <= shown ? "var(--warning)" : "var(--line)", fill: value <= shown ? "var(--warning)" : "transparent" }} />
          </button>
        ))}
        <span className="ml-2 text-sm text-mute">{WORDS[shown] ?? ""}</span>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="review-text">Your review (optional)</Label>
        <Textarea id="review-text" rows={3} maxLength={REVIEW_TEXT_MAX} value={text} onChange={(event) => setText(event.target.value)} placeholder="What did you like? Who is it for?" />
        <span className="text-xs text-mute">Shown on the product page with your first name and last initial.</span>
      </div>
      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="button" className="self-start" onClick={save} loading={pending} disabled={rating === 0}>
        {initial ? "Update review" : "Post review"}
      </Button>
    </section>
  );
}

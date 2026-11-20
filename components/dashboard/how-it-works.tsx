import { ChevronDown, HelpCircle } from "lucide-react";

// A short, closed-by-default "How does this work?" with numbered steps and an example (D-103), so
// creators understand a selling tool before turning it on. A plain <details>: no script needed.

export type HowItWorksContent = { steps: string[]; example: string };

export const BUMP_HOW_IT_WORKS: HowItWorksContent = {
  steps: [
    "On the checkout page of this product, buyers see your offer in a box with a tick.",
    "If they tick it, the offered product is added to the same payment, at your offer price. One payment, nothing more to fill in.",
    "After paying, they get both products in their library and in their email.",
  ],
  example: "Someone buys your $29 e-book. At checkout they see “Add the workbook for $9”, tick it, and pay $38 once.",
};

export const UPSELL_HOW_IT_WORKS: HowItWorksContent = {
  steps: [
    "Right after a buyer pays for this product, their thank-you page shows your one-time offer for another product.",
    "If they choose “Yes, add it”, a new checkout opens with your offer price and their details already filled in. They pay once more.",
    "The offer is shown for two hours after the purchase, and never to someone who already owns that product.",
  ],
  example: "Someone buys your $29 e-book. On the thank-you page they see “Add the full course for $49 (normally $99)”.",
};

export function HowItWorks({ content, title = "How does this work?" }: { content: HowItWorksContent; title?: string }) {
  return (
    <details className="group rounded-md border border-line bg-bg-subtle">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <HelpCircle aria-hidden="true" className="size-4 text-blue" />
        <span className="flex-1">{title}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-mute transition-transform duration-(--dur-fast) group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
        <ol className="flex flex-col gap-2">
          {content.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue text-xs font-semibold text-on-blue">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="rounded-md bg-surface px-3 py-2 text-sm text-mute">
          <span className="font-semibold text-ink">Example: </span>
          {content.example}
        </p>
      </div>
    </details>
  );
}

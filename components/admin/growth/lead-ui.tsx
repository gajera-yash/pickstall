import { Badge } from "@/components/ui/badge";
import type { LeadStore } from "@/lib/marketing/leads";
import { LEAD_STAGE_LABELS, LEAD_TOOL_LABELS, type LeadStage, type LeadTool } from "@/lib/marketing/leads-rules";

// Small pieces shared by the Growth pages (D-120).

const STAGE_VARIANT: Record<LeadStage, "live" | "draft" | "soon" | "danger" | "testMode"> = {
  new: "draft",
  contacted: "testMode",
  replied: "soon",
  interested: "live",
  call_booked: "live",
  not_interested: "draft",
  do_not_contact: "danger",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return <Badge variant={STAGE_VARIANT[stage]}>{LEAD_STAGE_LABELS[stage]}</Badge>;
}

/** The furthest step the lead's store reached, or null before signing up. */
export function progressLabel(store: LeadStore | null): string | null {
  if (!store) return null;
  if (store.steps.paidPlan) return "Paid plan";
  if (store.steps.firstSale) return "First sale";
  if (store.steps.paymentConnected) return "Payments on";
  if (store.steps.published) return "Store live";
  return "Signed up";
}

export function ProgressBadge({ store }: { store: LeadStore | null }) {
  const label = progressLabel(store);
  if (!label) return <span className="text-mute">-</span>;
  return <Badge variant="live">{label}</Badge>;
}

export function toolText(tool: LeadTool, label: string | null): string {
  return tool === "other" && label ? label : LEAD_TOOL_LABELS[tool];
}

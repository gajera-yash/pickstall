import { SignOutOthers } from "@/components/account/sign-out-others";
import { Card, CardHeader } from "@/components/ui/card";
import { listOwnAudit, type AuditAction, type AuditEntry } from "@/lib/audit/log";

const LABELS: Record<AuditAction, string> = {
  "auth.signed_in": "Signed in",
  "security.signed_out_other_devices": "Signed out other devices",
  "store.published": "Store published",
  "store.unpublished": "Store unpublished",
  "store.username_changed": "Store link changed",
  "stripe.connected": "Stripe connected",
  "stripe.disconnected": "Stripe disconnected",
  "plan.checkout_started": "Plan checkout opened",
  "plan.subscribed": "Plan started",
  "plan.changed": "Plan changed",
  "product.deleted": "Product deleted",
  "account.data_exported": "Data downloaded",
  "account.deleted": "Account deleted",
  "admin.trial_extended": "Admin: trial extended",
  "admin.founding_granted": "Admin: founding granted",
  "admin.store_suspended": "Admin: store suspended",
  "admin.store_restored": "Admin: store restored",
  "admin.product_unpublished": "Admin: product unpublished",
  "admin.broadcasts_blocked": "Admin: broadcasts blocked",
  "admin.broadcasts_unblocked": "Admin: broadcasts allowed",
};

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Only safe, short values are shown (the new link and the plan name); ids stay hidden. */
function detail(entry: AuditEntry): string | null {
  if (entry.action === "store.username_changed" && typeof entry.meta.username === "string") return `@${entry.meta.username}`;
  if (typeof entry.meta.plan === "string" && entry.meta.plan !== "unknown") return entry.meta.plan;
  return null;
}

/**
 * Security card (D-075): the person's own recent sensitive actions, and "Sign out other devices".
 * The list is read with the session user's id only, so nobody sees someone else's activity.
 */
export async function RecentActivity({ userId }: { userId: string }) {
  const entries = await listOwnAudit(userId, 15);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-h3">Security and recent activity</h2>
        <p className="text-sm text-mute">If you see something you didn&apos;t do, sign out other devices and sign in again with a fresh email code.</p>
      </CardHeader>

      {entries.length === 0 ? (
        <p className="text-sm text-mute">No activity recorded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {entries.map((entry) => {
            const extra = detail(entry);
            return (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <span className="text-ink">
                  {LABELS[entry.action] ?? entry.action}
                  {extra && <span className="text-mute"> · {extra}</span>}
                </span>
                <time dateTime={entry.at.toISOString()} className="text-xs text-mute">
                  {when.format(entry.at)} UTC
                </time>
              </li>
            );
          })}
        </ul>
      )}

      <SignOutOthers />
    </Card>
  );
}

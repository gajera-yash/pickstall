import { SignOutOthers } from "@/components/account/sign-out-others";
import { Card, CardHeader } from "@/components/ui/card";
import { AUDIT_LABELS as LABELS } from "@/lib/audit/labels";
import { listOwnAudit, type AuditEntry } from "@/lib/audit/log";


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

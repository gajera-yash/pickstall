import Link from "next/link";
import { Suspense } from "react";

import { AdminPageTitle, Stat } from "@/components/admin/admin-ui";
import { RetryEmailsButton } from "@/components/admin/retry-emails-button";
import { formatDateTime, ListCard } from "@/components/dashboard/orders-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/admin/guard";
import { adminHealth } from "@/lib/admin/queries";
import { checkEmailSetup, type EmailSetup } from "@/lib/email/health";
import { AUDIT_LABELS } from "@/lib/audit/labels";
import type { AuditAction } from "@/lib/audit/log";

// Admin: signs that something needs attention, and storage use (D-104). Inngest, Stripe, Resend,
// Bunny and Sentry keep their own detailed logs; this page shows what our database knows.
export default function AdminHealthPage() {
  return (
    <>
      <AdminPageTitle title="Health" description="Webhooks, background work and storage. Details live in PayPal, Inngest, Resend, Bunny and Sentry." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <HealthContent />
      </Suspense>
    </>
  );
}

async function HealthContent() {
  await requireAdmin();
  const [data, email] = await Promise.all([adminHealth(), checkEmailSetup()]);
  const hooks = (source: string) => data.webhooks24h.find((row) => row.source === source)?.count ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <EmailCheck email={email} failures={data.emailFailures24h} last={data.lastEmailFailure} />

      <section aria-label="Webhooks" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Payment webhooks, 24h" value={(hooks("paypal") + hooks("stripe") + hooks("stripe-connect")).toLocaleString("en")} hint="Handled events" />
        <Stat label="Bunny webhooks, 24h" value={hooks("bunny").toLocaleString("en")} />
        <Stat label="Resend webhooks, 24h" value={hooks("resend").toLocaleString("en")} hint="Bounces and complaints" />
        <Stat label="Unpaid checkouts, 24h" value={data.unpaidOrders24h.toLocaleString("en")} hint="Pending or failed" />
      </section>
      <section aria-label="Background work" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Stuck broadcasts" value={data.stuckBroadcasts.toLocaleString("en")} hint="Sending for over an hour: check Inngest is synced" />
        <Stat label="Unfinished uploads" value={data.pendingUploads.toLocaleString("en")} hint="Cleaned up daily" />
        <Stat label="Database" value={data.database ? `${data.database.dataMb} MB` : "-"} hint={data.database ? `${data.database.storageMb} MB on disk · ${data.database.collections} collections` : "Stats not available"} />
        <Stat label="Images in database" value={`${data.imagesMb} MB`} hint="Move to R2 before the database fills" />
      </section>

      <section aria-labelledby="admin-audit" className="flex flex-col gap-3">
        <h2 id="admin-audit" className="font-display text-h3">
          Latest audit log
        </h2>
        {data.auditRecent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-mute">Nothing logged yet.</p>
        ) : (
          <ListCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Action</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>When (UTC)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.auditRecent.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="whitespace-nowrap font-semibold">{AUDIT_LABELS[row.action as AuditAction] ?? row.action}</TableCell>
                    <TableCell className="max-w-48 truncate">
                      {row.storeId ? (
                        <Link href={`/admin/creators/${row.storeId}`} className="hover:underline">
                          {row.storeName ?? "Deleted store"}
                        </Link>
                      ) : (
                        <span className="text-mute">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-mute">{formatDateTime(row.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ListCard>
        )}
      </section>
    </div>
  );
}

/** What is wrong with sending email, in words the founder can act on (Vercel env and Resend). */
function emailProblem(email: EmailSetup): string | null {
  if (email.key === "missing") return "RESEND_API_KEY is not set on this server. Add it in Vercel > Settings > Environment Variables and redeploy.";
  if (email.key === "invalid") return "Resend says the RESEND_API_KEY on this server is invalid (deleted or mistyped). Create a new key in Resend > API Keys, put it in Vercel and redeploy.";
  if (email.testSender) return "EMAIL_FROM is Resend's test sender, which only delivers to your own Resend inbox. Set EMAIL_FROM to an address on your verified domain.";
  if (email.domainStatus === "not_found") return `The domain ${email.fromDomain ?? "of EMAIL_FROM"} is not added in Resend. Add it in Resend > Domains and add its DNS records.`;
  if (email.domainStatus && email.domainStatus !== "verified") return `The domain ${email.fromDomain} is "${email.domainStatus}" in Resend, not verified yet. Check its DNS records in Resend > Domains.`;
  return null;
}

function EmailCheck({ email, failures, last }: { email: EmailSetup; failures: number; last: { reason: string | null; at: Date; kind: string } | null }) {
  const problem = emailProblem(email);
  return (
    <section aria-labelledby="email-check" className="flex flex-col gap-3">
      <h2 id="email-check" className="font-display text-h3">
        Email sending
      </h2>
      <Alert variant={problem ? "error" : email.key === "valid" ? "success" : "info"}>
        <AlertTitle>{problem ? "Emails can't be sent" : email.key === "valid" ? "Email setup looks right" : "Email key works for sending only"}</AlertTitle>
        <AlertDescription>
          {problem ??
            (email.key === "valid"
              ? `Key valid, sending from ${email.from} (${email.fromDomain} verified in Resend).`
              : email.key === "send_only"
                ? "This key can send but cannot list domains, so the domain could not be checked here. If emails still fail, see the last failure below."
                : "Resend could not be reached to check the setup. Try again in a minute.")}
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Failed emails, 24h" value={failures.toLocaleString("en")} hint="Order access emails and call emails" />
        <Stat label="Last failure" value={last ? formatDateTime(last.at) : "None"} hint={last?.reason ?? (last ? "No reason saved (before this check existed)" : "Nothing has failed")} />
      </div>
      {failures > 0 || last ? <RetryEmailsButton /> : null}
    </section>
  );
}

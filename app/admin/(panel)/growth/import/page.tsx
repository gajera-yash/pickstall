import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminPageTitle } from "@/components/admin/admin-ui";
import { LeadImport } from "@/components/admin/growth/lead-import";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";

// Import the founder's creator list (D-120). The file is read in the browser; the import action
// checks the admin session and every row again.
export default function AdminLeadImportPage() {
  return (
    <>
      <Link href="/admin/growth" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All leads
      </Link>
      <AdminPageTitle title="Import a list" description="Your own list of creators to contact, as a CSV. Each creator gets a personal link." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <ImportContent />
      </Suspense>
    </>
  );
}

async function ImportContent() {
  await requireAdmin();
  return <LeadImport />;
}

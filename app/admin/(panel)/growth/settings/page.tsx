import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminPageTitle } from "@/components/admin/admin-ui";
import { GrowthSettingsForm } from "@/components/admin/growth/growth-settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";
import { getGrowthSettings, writerStatus } from "@/lib/marketing/drafts";

// Growth settings (D-121): the founder's voice for AI drafts, and the daily limits.
export default function GrowthSettingsPage() {
  return (
    <>
      <Link href="/admin/growth" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All leads
      </Link>
      <AdminPageTitle title="Growth settings" description="How DM drafts are written, and how many a day." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  await requireAdmin();
  const [settings, writer] = await Promise.all([getGrowthSettings(), Promise.resolve(writerStatus())]);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="writer-title" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <h2 id="writer-title" className="font-display text-h4">
          Who writes drafts
        </h2>
        {writer.name === "groq" ? (
          <p className="text-sm">
            Groq, model <code>{writer.model}</code>. Only a creator&apos;s first name, topic, store tool, follower range and country are sent; never their handle or your notes. If Groq is busy or a draft breaks a rule, the template is used.
          </p>
        ) : (
          <p className="text-sm">
            The template (no AI, free). To use Groq, set <code>MARKETING_AI_PROVIDER=groq</code> and <code>GROQ_API_KEY</code> in the environment, and turn on Zero Data Retention in Groq&apos;s Data Controls.
          </p>
        )}
      </section>
      <GrowthSettingsForm initial={settings} />
    </div>
  );
}

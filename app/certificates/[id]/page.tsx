import type { Metadata } from "next";
import { Award } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { PrintButton } from "@/components/course/print-button";
import { formatDay } from "@/components/dashboard/orders-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { publicCertificate } from "@/lib/certificates/queries";
import { APP_NAME } from "@/lib/config";

// A course certificate (D-111), public by its random link so a student can share or print it. It
// shows only what is printed on it (no email, no order), is never indexed, and shows "revoked"
// once the order is refunded.
export const metadata: Metadata = { title: `Certificate | ${APP_NAME}`, robots: { index: false, follow: false } };

export default function CertificatePage({ params }: PageProps<"/certificates/[id]">) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-bg-subtle px-4 py-8 print:bg-surface print:p-0">
      <Suspense fallback={<Skeleton className="aspect-[1.414] w-full max-w-4xl rounded-lg" />}>
        <Certificate params={params} />
      </Suspense>
    </div>
  );
}

async function Certificate({ params }: Pick<PageProps<"/certificates/[id]">, "params">) {
  const { id } = await params;
  const certificate = await publicCertificate(id);
  if (!certificate) notFound();

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      {certificate.revoked ? (
        <Alert variant="warning">
          <AlertDescription>This certificate was revoked: the purchase of the course was refunded.</AlertDescription>
        </Alert>
      ) : (
        <div className="flex justify-end print:hidden">
          <PrintButton />
        </div>
      )}

      <article
        aria-label="Certificate of completion"
        className="relative flex min-h-[420px] w-full flex-col sm:aspect-[1.414] sm:min-h-0 items-center justify-center gap-4 overflow-hidden rounded-lg border-8 border-double border-blue bg-surface p-6 text-center sm:gap-6 sm:p-12 print:rounded-none print:break-inside-avoid"
      >
        <Award aria-hidden="true" className="size-10 text-blue sm:size-14" />
        <p className="text-xs font-semibold tracking-widest text-mute uppercase sm:text-sm">Certificate of completion</p>
        <p className="text-sm text-mute sm:text-base">This certifies that</p>
        <h1 className="max-w-full font-display text-h2 break-words sm:text-h1">{certificate.studentName}</h1>
        <p className="text-sm text-mute sm:text-base">has completed the course</p>
        <p className="max-w-full font-display text-h4 break-words sm:text-h3">{certificate.courseTitle}</p>
        {certificate.storeName && <p className="text-sm sm:text-base">by {certificate.storeName}</p>}
        <div className="mt-2 flex flex-col items-center gap-1 text-xs text-mute sm:text-sm">
          <p>Issued {formatDay(certificate.issuedAt)}</p>
          <p className="font-mono break-all">Certificate ID {certificate.id}</p>
        </div>
        <Wordmark className="absolute right-4 bottom-4 h-5 opacity-60 sm:h-6" />
        {certificate.revoked && (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-6xl font-bold tracking-widest text-danger/30 uppercase sm:text-8xl">
            Revoked
          </span>
        )}
      </article>
    </div>
  );
}

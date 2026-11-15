import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LEGAL, LEGAL_PAGES, legalPlaceholders } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Shared layout for the legal pages (D-074): title, effective date, contents, sections and the
 * contact block. Plain text from the code only; nothing from users is rendered here.
 */
export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  const draft = legalPlaceholders().length > 0;
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
          <Wordmark className="h-8" />
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">{title}</h1>
          <p className="text-sm text-mute">Effective {LEGAL.effectiveDate}</p>
        </div>

        {draft && (
          <Alert variant="warning">
            <AlertDescription>Draft: some operator details are still being filled in. The terms below already apply to the test version.</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3 text-base leading-relaxed">{intro}</div>

        <nav aria-label="Contents" className="rounded-lg border border-line bg-bg-subtle p-5">
          <p className="mb-2 text-sm font-semibold">Contents</p>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-blue underline underline-offset-4 hover:text-blue-hover">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((section, index) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="flex scroll-mt-6 flex-col gap-3">
            <h2 id={`${section.id}-title`} className="text-h2">
              {index + 1}. {section.title}
            </h2>
            <div className="flex flex-col gap-3 leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">{section.body}</div>
          </section>
        ))}

        <section aria-labelledby="contact-title" className="flex flex-col gap-2 rounded-lg border border-line p-5">
          <h2 id="contact-title" className="text-h3">
            Contact
          </h2>
          <ContactBlock />
        </section>
      </main>
      <footer className="border-t border-line bg-bg-subtle">
        <nav aria-label="Legal" className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-5 gap-y-2 px-4 py-6 text-sm sm:px-6">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.href} href={page.href} className="font-semibold text-ink hover:text-blue">
              {page.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}

/** Who runs Pickstall and how to reach the Grievance Officer. */
export function ContactBlock() {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        {LEGAL.operatorName}, {LEGAL.city}, {LEGAL.state}, {LEGAL.country}
      </p>
      <p>Postal address: {LEGAL.postalAddress}</p>
      <p>
        Email:{" "}
        <a href={`mailto:${LEGAL.contactEmail}`} className="text-blue underline underline-offset-4">
          {LEGAL.contactEmail}
        </a>
      </p>
      <p>
        Grievance Officer: {LEGAL.grievanceOfficer.name},{" "}
        <a href={`mailto:${LEGAL.grievanceOfficer.email}`} className="text-blue underline underline-offset-4">
          {LEGAL.grievanceOfficer.email}
        </a>
        . We acknowledge complaints within 24 hours and aim to resolve them within 15 days.
      </p>
    </div>
  );
}

/** An inline link to another legal page. */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-blue underline underline-offset-4 hover:text-blue-hover">
      {children}
    </Link>
  );
}

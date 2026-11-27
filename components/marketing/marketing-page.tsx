import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { LandingNav } from "@/components/landing/landing-nav";
import { MotionProvider } from "@/components/landing/motion";
import { GuestActions, NavActions } from "@/components/landing/nav-actions";
import { FinalCta, LandingFooter } from "@/components/landing/sections";
import { Container } from "@/components/landing/ui";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, webPageSchema } from "@/lib/seo/schema";
import { CONTENT_UPDATED } from "@/lib/seo/site-facts";

/**
 * The frame of Pickstall's public content pages (D-134): the landing nav and footer, a breadcrumb
 * (visible and as structured data), a clear H1 with a one-paragraph answer under it, then the page.
 * The "Last updated" date (D-135) helps answer engines judge how fresh the facts are.
 */
const updatedLabel = new Date(`${CONTENT_UPDATED}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export function MarketingPage({
  title,
  lead,
  crumbs,
  children,
  schema = [],
  cta = true,
}: {
  title: string;
  /** The short answer under the title: what this page is about, in two or three sentences. */
  lead: ReactNode;
  crumbs: { name: string; path: string }[];
  children: ReactNode;
  schema?: Record<string, unknown>[];
  cta?: boolean;
}) {
  const trail = [{ name: "Home", path: "/" }, ...crumbs];
  const path = trail[trail.length - 1]?.path ?? "/";
  return (
    <>
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <JsonLd data={[breadcrumbSchema(trail), webPageSchema(title, path), ...schema]} />
      <LandingNav
        actions={
          <Suspense fallback={<GuestActions />}>
            <NavActions />
          </Suspense>
        }
      />
      <main id="main" className="flex-1">
        <Container className="flex flex-col gap-6 pt-10 pb-12 sm:pt-14">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-mute">
              {trail.map((crumb, index) => (
                <li key={crumb.path} className="flex items-center gap-1.5">
                  {index > 0 && <span aria-hidden="true">/</span>}
                  {index === trail.length - 1 ? (
                    <span aria-current="page" className="text-ink">
                      {crumb.name}
                    </span>
                  ) : (
                    <Link href={crumb.path} className="hover:text-ink">
                      {crumb.name}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="max-w-3xl text-display-l text-balance">{title}</h1>
          <div className="max-w-2xl text-body-l text-mute text-pretty">{lead}</div>
          <p className="text-sm text-mute">
            Last updated <time dateTime={CONTENT_UPDATED}>{updatedLabel}</time>
          </p>
        </Container>
        {/* The landing sections reused here animate with the motion bundle. */}
        <MotionProvider>
          {children}
          {cta && <FinalCta />}
        </MotionProvider>
      </main>
      <LandingFooter />
    </>
  );
}

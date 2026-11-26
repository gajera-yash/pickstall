import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { LandingNav } from "@/components/landing/landing-nav";
import { MotionProvider } from "@/components/landing/motion";
import { GuestActions, NavActions } from "@/components/landing/nav-actions";
import { FinalCta, LandingFooter } from "@/components/landing/sections";
import { Container } from "@/components/landing/ui";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/seo/schema";

/**
 * The frame of Pickstall's public content pages (D-134): the landing nav and footer, a breadcrumb
 * (visible and as structured data), a clear H1 with a one-paragraph answer under it, then the page.
 */
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
  return (
    <>
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <JsonLd data={[breadcrumbSchema(trail), ...schema]} />
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

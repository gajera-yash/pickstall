import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompareStan } from "@/components/landing/compare-stan";
import { CompareView } from "@/components/marketing/compare-view";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { APP_NAME } from "@/lib/config";
import { COMPARE_PAGES, findCompare } from "@/lib/seo/pages";
import { SHARE_IMAGE, SITE_URL } from "@/lib/seo/site-facts";

// Honest comparison pages (D-134): Pickstall vs Stan Store, Gumroad and Linktree, with sources.

export function generateStaticParams() {
  return COMPARE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const page = findCompare((await params).slug);
  if (!page) return { title: `Not found | ${APP_NAME}` };
  return { title: `${page.title} (2026): plans, fees and features`, description: page.description, alternates: { canonical: `${SITE_URL}/compare/${page.slug}` }, openGraph: { title: page.title, description: page.description, type: "article", images: [SHARE_IMAGE] } };
}

export default async function ComparePageRoute({ params }: PageProps<"/compare/[slug]">) {
  const page = findCompare((await params).slug);
  if (!page) notFound();
  return (
    <MarketingPage title={page.title} lead={<p>{page.lead}</p>} crumbs={[{ name: `Vs ${page.name}`, path: `/compare/${page.slug}` }]}>
      <CompareView page={page} />
      {page.slug === "stan-store" && <CompareStan />}
    </MarketingPage>
  );
}

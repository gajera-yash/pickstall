import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UseCaseView } from "@/components/marketing/compare-view";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { APP_NAME } from "@/lib/config";
import { USE_CASE_PAGES, findUseCase } from "@/lib/seo/pages";
import { SHARE_IMAGE, SITE_URL } from "@/lib/seo/site-facts";

// Use-case pages (D-134): what coaches, fitness creators and course creators sell with Pickstall.

export function generateStaticParams() {
  return USE_CASE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps<"/for/[slug]">): Promise<Metadata> {
  const page = findUseCase((await params).slug);
  if (!page) return { title: `Not found | ${APP_NAME}` };
  return { title: page.title, description: page.description, alternates: { canonical: `${SITE_URL}/for/${page.slug}` }, openGraph: { title: page.title, description: page.description, type: "website", images: [SHARE_IMAGE] } };
}

export default async function UseCaseRoute({ params }: PageProps<"/for/[slug]">) {
  const page = findUseCase((await params).slug);
  if (!page) notFound();
  return (
    <MarketingPage title={page.title} lead={<p>{page.lead}</p>} crumbs={[{ name: page.who, path: `/for/${page.slug}` }]}>
      <UseCaseView page={page} />
    </MarketingPage>
  );
}

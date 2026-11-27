import { COMING_SOON, FAQ } from "@/components/landing/content";
import { APP_NAME } from "@/lib/config";
import { COMPARE_PAGES, USE_CASE_PAGES } from "@/lib/seo/pages";
import { CONTENT_UPDATED, KEY_FACTS, ONE_LINER, SHORT_PITCH, SITE_URL } from "@/lib/seo/site-facts";

// /llms-full.txt (GEO, D-135): the full text an AI assistant needs to answer questions about
// Pickstall in one file: key facts, every FAQ answer, the comparison tables with their sources and
// the use-case pages. Built from the same data as the pages, so it never disagrees with them.
// Reads no request data, so it is prerendered at build time.

export function GET() {
  const body = [
    `# ${APP_NAME}`,
    "",
    `> ${ONE_LINER}`,
    "",
    SHORT_PITCH,
    "",
    `Website: ${SITE_URL}. Facts last checked: ${CONTENT_UPDATED}. Short version: ${SITE_URL}/llms.txt`,
    "",
    "## Key facts",
    "",
    ...KEY_FACTS.map((fact) => `- ${fact}`),
    `- Coming soon (not live yet): ${COMING_SOON.join(", ")}.`,
    "",
    "## Frequently asked questions",
    "",
    ...FAQ.flatMap((item) => [`### ${item.q}`, "", item.a, ""]),
    "## Comparisons",
    "",
    ...COMPARE_PAGES.flatMap((page) => [
      `### ${page.title}`,
      "",
      `Page: ${SITE_URL}/compare/${page.slug}`,
      "",
      page.lead,
      "",
      `| Topic | ${APP_NAME} | ${page.name} |`,
      "| --- | --- | --- |",
      ...page.rows.map((row) => `| ${row.topic} | ${row.pickstall} | ${row.other} |`),
      "",
      `${page.name} facts from: ${page.source.label} (${page.source.url}), checked ${page.source.checkedOn}.`,
      "",
      `Why creators pick ${APP_NAME}:`,
      ...page.whyPickstall.map((line) => `- ${line}`),
      "",
      `When ${page.name} may suit you better:`,
      ...page.whenOther.map((line) => `- ${line}`),
      "",
    ]),
    "## Who uses it",
    "",
    ...USE_CASE_PAGES.flatMap((page) => [
      `### ${page.who}`,
      "",
      `Page: ${SITE_URL}/for/${page.slug}`,
      "",
      page.lead,
      "",
      "What they sell:",
      ...page.sells.map((line) => `- ${line}`),
      "",
      "Tools they use:",
      ...page.tools.map((line) => `- ${line}`),
      "",
    ]),
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

import { APP_NAME } from "@/lib/config";
import { COMPARE_PAGES, USE_CASE_PAGES } from "@/lib/seo/pages";
import { KEY_FACTS, ONE_LINER, SHORT_PITCH, SITE_URL } from "@/lib/seo/site-facts";

// /llms.txt (D-134): a short Markdown summary of Pickstall for AI assistants and answer engines, in
// the llms.txt format (a title, a one-line summary, then sections of links). Built from the same
// site facts as the pages, so they never disagree. It reads no request data, so with Cache
// Components it is prerendered at build time (no route segment config allowed there).

export function GET() {
  const link = (title: string, path: string, note: string) => `- [${title}](${SITE_URL}${path}): ${note}`;
  const body = [
    `# ${APP_NAME}`,
    "",
    `> ${ONE_LINER}`,
    "",
    SHORT_PITCH,
    "",
    "## Key facts",
    "",
    ...KEY_FACTS.map((fact) => `- ${fact}`),
    "",
    "## Main pages",
    "",
    link("Home", "/", "what Pickstall is and how a creator store works"),
    link("Pricing", "/pricing", "plans, prices, free trial and the 0% transaction fee"),
    link("Features", "/features", "every feature live today"),
    link("FAQ", "/faq", "fees, payments, taxes and what you can sell"),
    link("About", "/about", "who it is for and how Pickstall makes money"),
    "",
    "## Comparisons",
    "",
    ...COMPARE_PAGES.map((page) => link(page.title, `/compare/${page.slug}`, page.description)),
    "",
    "## For creators",
    "",
    ...USE_CASE_PAGES.map((page) => link(page.title, `/for/${page.slug}`, page.description)),
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

import { CONTENT_LIMITS, type ContentBrief, type ContentPillar, type ContentSet } from "@/lib/marketing/content/rules";

// The free content writer (D-136): turns a brief into posts for every platform with fixed shapes.
// Used when no AI is set up, and whenever an AI draft fails or breaks a rule.

const SITE = "pickstall.store";
const ABOUT = "I'm building Pickstall, a link-in-bio store for digital products, courses and coaching.";

const CLOSERS: Record<ContentPillar, string> = {
  tips: "Save this for your next launch.",
  feature: "Built into every Pickstall store.",
  build: "Building this in public, one week at a time.",
  fees: "Simple pricing, no surprises.",
  story: "Thanks for following along.",
};

const HASHTAGS: Record<ContentPillar, string[]> = {
  tips: ["creatortips", "digitalproducts", "linkinbio", "onlinebusiness", "creatoreconomy"],
  feature: ["pickstall", "linkinbio", "digitalproducts", "onlinecourses", "creatortools"],
  build: ["buildinpublic", "startup", "solofounder", "pickstall", "saas"],
  fees: ["creatoreconomy", "linkinbio", "digitalproducts", "pickstall", "sidehustle"],
  story: ["buildinpublic", "solofounder", "startup", "pickstall", "creatoreconomy"],
};

const bullets = (points: string[]) => points.map((point) => `- ${point}`).join("\n");
const numbered = (points: string[]) => points.map((point, index) => `${index + 1}. ${point}`).join("\n");

/** As many points as fit under the X limit, with the site at the end when there is room. */
function xPost(brief: ContentBrief): string {
  let text = brief.headline;
  for (const point of brief.points) {
    const next = `${text}${text === brief.headline ? "\n\n" : "\n"}- ${point}`;
    if (next.length > CONTENT_LIMITS.x) break;
    text = next;
  }
  const withSite = `${text}\n\n${SITE}`;
  return withSite.length <= CONTENT_LIMITS.x ? withSite : text.slice(0, CONTENT_LIMITS.x);
}

function updateLine(brief: ContentBrief): string {
  return brief.pillar === "build" && brief.update ? `\n\nThis week: ${brief.update}` : "";
}

export function templateContent(brief: ContentBrief): ContentSet {
  const closer = CLOSERS[brief.pillar];
  const points = brief.points.slice(0, CONTENT_LIMITS.slidesMax);
  const linkedin = `${brief.headline}\n\n${numbered(points)}${updateLine(brief)}\n\n${closer}\n\n${ABOUT}`;
  const instagram = `${brief.headline}\n\n${bullets(points)}${updateLine(brief)}\n\n${closer} Link in bio.`;
  const facebook = `${brief.headline}\n\n${bullets(points)}${updateLine(brief)}\n\n${closer}\n${SITE}`;
  const youtubeDescription = `${brief.headline}\n\n${bullets(points)}\n\n${ABOUT}\n${SITE}`;
  const youtubeScript = [`Hook: ${brief.headline}.`, ...points.map((point, index) => `${index + 1}. ${point}`), `End: ${closer} Follow for more.`].join("\n");
  return {
    headline: brief.headline.slice(0, CONTENT_LIMITS.headline),
    slides: points.map((point) => point.slice(0, CONTENT_LIMITS.slide)),
    x: xPost(brief),
    linkedin: linkedin.slice(0, CONTENT_LIMITS.linkedin),
    instagram: instagram.slice(0, CONTENT_LIMITS.instagram),
    facebook: facebook.slice(0, CONTENT_LIMITS.facebook),
    youtubeTitle: brief.headline.slice(0, CONTENT_LIMITS.youtubeTitle),
    youtubeDescription: youtubeDescription.slice(0, CONTENT_LIMITS.youtubeDescription),
    youtubeScript: youtubeScript.slice(0, CONTENT_LIMITS.youtubeScript),
    hashtags: HASHTAGS[brief.pillar],
  };
}

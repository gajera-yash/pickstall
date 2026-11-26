// Tells IndexNow engines (Bing, which ChatGPT search and Copilot use, and others) to recrawl every URL
// in the live sitemap (D-134). Run after a deploy that adds or changes public pages:
//   INDEXNOW_KEY=<your key> pnpm indexnow
// The key must also be set in Vercel, so https://www.pickstall.store/indexnow.txt serves it.
// Protocol: https://www.indexnow.org/documentation (POST JSON with host, key, keyLocation, urlList).

const SITE = "https://www.pickstall.store";
const key = process.env.INDEXNOW_KEY;
if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
  process.stderr.write("Set INDEXNOW_KEY (8-128 letters, digits or dashes) first.\n");
  process.exit(1);
}

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).filter((url) => url.startsWith(SITE)).slice(0, 10000);
if (urls.length === 0) {
  process.stderr.write("No URLs found in the sitemap.\n");
  process.exit(1);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/indexnow.txt`, urlList: urls }),
});
process.stdout.write(`IndexNow answered ${response.status} for ${urls.length} URLs.\n`);
if (!response.ok && response.status !== 202) process.exit(1);

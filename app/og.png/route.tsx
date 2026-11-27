import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { SHARE_IMAGE_COLORS as C } from "@/lib/brand-colors";
import { APP_NAME } from "@/lib/config";
import { PRICES, SHARE_IMAGE } from "@/lib/seo/site-facts";

// Pickstall's share image (1200 x 630) for links to its own marketing pages: shown by WhatsApp, X,
// LinkedIn, Facebook and Slack previews. Built with next/og (no extra dependency); every "0%" here
// sits next to PayPal's processing fees (PRD section 2.6).

export async function GET() {
  const logo = await readFile(path.join(process.cwd(), "public", "brand", "pickstall.jpg"));
  const logoSrc = `data:image/jpeg;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: C.background, color: C.ink, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img elements */}
          <img src={logoSrc} width={96} height={96} alt="" style={{ borderRadius: 20 }} />
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>Your link-in-bio store for digital products, courses and coaching</div>
          <div style={{ display: "flex", fontSize: 32, color: C.mute }}>0% transaction fees. PayPal&apos;s processing fees still apply.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.blue }}>pickstall.store</div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, background: C.yellow, color: C.ink, padding: "12px 24px", borderRadius: 999 }}>
            Plans from ${PRICES.starter}/month
          </div>
        </div>
      </div>
    ),
    { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height, headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}

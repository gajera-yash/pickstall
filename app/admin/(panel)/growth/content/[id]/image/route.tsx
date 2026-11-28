import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { currentAdmin } from "@/lib/admin/guard";
import { SHARE_IMAGE_COLORS as C } from "@/lib/brand-colors";
import { APP_NAME, TRIAL_DAYS } from "@/lib/config";
import { getPost } from "@/lib/marketing/content/posts";
import { CONTENT_IMAGE_FORMAT, slideCount } from "@/lib/marketing/content/rules";
import { PRICES } from "@/lib/seo/site-facts";

// Images for one daily post (D-136), drawn with next/og like /og.png (no extra dependency). Carousel
// platforms get 1080 x 1350 slides: a cover, one per point and a closing card; X and YouTube get one
// 1280 x 720 cover. Admins only (anyone else gets a 404). Text is drawn as text, never as HTML.

const NO_STORE = { "Cache-Control": "no-store" };
const query = z.object({ slide: z.coerce.number().int().min(0).max(20).default(0), download: z.enum(["1"]).optional() });

async function logoSrc(): Promise<string> {
  const logo = await readFile(path.join(process.cwd(), "public", "brand", "pickstall.jpg"));
  return `data:image/jpeg;base64,${logo.toString("base64")}`;
}

function Brand({ logo, size }: { logo: string; size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size / 3 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img elements */}
      <img src={logo} width={size} height={size} alt="" style={{ borderRadius: size / 5 }} />
      <div style={{ display: "flex", fontSize: size * 0.6, fontWeight: 700 }}>{APP_NAME}</div>
    </div>
  );
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  const { id } = await context.params;
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!z.uuid().safeParse(id).success || !parsed.success) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  const post = await getPost(id);
  if (!post) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  const total = slideCount(post.platform, post.slides);
  const slide = parsed.data.slide;
  if (slide >= total) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  const logo = await logoSrc();
  const wide = CONTENT_IMAGE_FORMAT[post.platform] === "wide";
  const size = wide ? { width: 1280, height: 720 } : { width: 1080, height: 1350 };
  const frame = { width: "100%", height: "100%", display: "flex", flexDirection: "column" as const, justifyContent: "space-between", padding: wide ? "56px 72px" : "80px 84px", background: C.background, color: C.ink, fontFamily: "sans-serif" };
  const footer = (right: string) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", fontSize: wide ? 30 : 36, fontWeight: 700, color: C.blue }}>pickstall.store</div>
      <div style={{ display: "flex", fontSize: wide ? 26 : 32, fontWeight: 700, background: C.yellow, color: C.ink, padding: "12px 26px", borderRadius: 999 }}>{right}</div>
    </div>
  );

  let body;
  if (slide === 0) {
    body = (
      <div style={frame}>
        <Brand logo={logo} size={wide ? 72 : 96} />
        <div style={{ display: "flex", fontSize: wide ? 72 : 88, fontWeight: 700, lineHeight: 1.1 }}>{post.headline}</div>
        {footer(wide ? `Plans from $${PRICES.starter}/month` : "Swipe")}
      </div>
    );
  } else if (slide <= post.slides.length) {
    body = (
      <div style={frame}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Brand logo={logo} size={72} />
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: C.mute }}>{`${slide}/${post.slides.length}`}</div>
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.2 }}>{post.slides[slide - 1] ?? ""}</div>
        {footer("Save this")}
      </div>
    );
  } else {
    body = (
      <div style={frame}>
        <Brand logo={logo} size={96} />
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>Sell digital products, courses and coaching from one link</div>
          <div style={{ display: "flex", fontSize: 40, color: C.mute }}>0% transaction fees. PayPal&apos;s processing fees still apply.</div>
          <div style={{ display: "flex", fontSize: 40, color: C.mute }}>{`Plans from $${PRICES.starter}/month. ${TRIAL_DAYS}-day free trial.`}</div>
        </div>
        {footer("Link in bio")}
      </div>
    );
  }

  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (parsed.data.download) headers["Content-Disposition"] = `attachment; filename="pickstall-${post.day}-${post.platform}-${slide + 1}.png"`;
  return new ImageResponse(body, { ...size, headers });
}

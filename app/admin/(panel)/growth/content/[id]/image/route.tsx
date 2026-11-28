import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { PortraitClosing, PortraitCover, PortraitPoint, WideCover } from "./post-image";
import { currentAdmin } from "@/lib/admin/guard";
import { POST_IMAGE_THEMES } from "@/lib/brand-colors";
import { getPost } from "@/lib/marketing/content/posts";
import { CONTENT_IMAGE_FORMAT, postThemeForDay, slideCount } from "@/lib/marketing/content/rules";

// Images for one daily post (D-136), drawn with next/og like /og.png (no extra dependency). Carousel
// platforms get 1080 x 1350 slides: a cover, one per point and a closing card; X and YouTube get one
// 1280 x 720 cover. White and brand-blue looks alternate by day. Admins only (anyone else gets a
// 404). Text is drawn as text, never as HTML.

const NO_STORE = { "Cache-Control": "no-store" };
const query = z.object({ slide: z.coerce.number().int().min(0).max(20).default(0), download: z.enum(["1"]).optional(), theme: z.enum(["white", "blue"]).optional() });

async function logoSrc(): Promise<string> {
  const logo = await readFile(path.join(process.cwd(), "public", "brand", "pickstall.jpg"));
  return `data:image/jpeg;base64,${logo.toString("base64")}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  const { id } = await context.params;
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!z.uuid().safeParse(id).success || !parsed.success) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  const post = await getPost(id);
  if (!post) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  const slide = parsed.data.slide;
  if (slide >= slideCount(post.platform, post.slides)) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  const logo = await logoSrc();
  // The day picks the look; `theme` previews the other one.
  const theme = POST_IMAGE_THEMES[parsed.data.theme ?? postThemeForDay(post.day)];
  const wide = CONTENT_IMAGE_FORMAT[post.platform] === "wide";
  const common = { theme, logo, pillar: post.pillar };

  const body = wide ? (
    <WideCover {...common} headline={post.headline} />
  ) : slide === 0 ? (
    <PortraitCover {...common} headline={post.headline} />
  ) : slide <= post.slides.length ? (
    <PortraitPoint {...common} text={post.slides[slide - 1] ?? ""} index={slide} total={post.slides.length} />
  ) : (
    <PortraitClosing theme={theme} logo={logo} />
  );

  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (parsed.data.download) headers["Content-Disposition"] = `attachment; filename="pickstall-${post.day}-${post.platform}-${slide + 1}.png"`;
  return new ImageResponse(body, { ...(wide ? { width: 1280, height: 720 } : { width: 1080, height: 1350 }), headers });
}

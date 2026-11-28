"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { logger } from "@/lib/logger";
import { getPost, markPostPosted, saveContentSettings, setPostStatus, updatePostText, writeDayPosts } from "@/lib/marketing/content/posts";
import { cleanPostText, contentSettingsInput, CONTENT_LIMITS, isContentDay, postedUrlOk } from "@/lib/marketing/content/rules";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// Content agent actions (D-136). Each one: requireAdmin(), Zod-checked input, a rate limit, the change.

const CONTENT_PATH = "/admin/growth/content";
const SLOW_DOWN = "Slow down a little, then try again.";
const NOT_FOUND = "This post was not found.";
const postInput = z.object({ postId: z.uuid() });

/** Writes the day's posts (fills missing platforms, or rewrites drafts with `replace`). */
export async function writeDayPostsAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = z.object({ day: z.string().refine(isContentDay), replace: z.boolean() }).safeParse(raw);
  if (!parsed.success) return err("Pick a valid day.");
  if (!(await takeRateLimit(rateLimitKey("admin-content-write", admin.id), 10, 60))) return err("That's a lot of rewrites. Try again in a while.");
  try {
    const result = await writeDayPosts(parsed.data.day, { replace: parsed.data.replace });
    revalidatePath(CONTENT_PATH);
    if (result.written === 0) return ok({ message: "Nothing to write: every platform already has a post (posted or skipped posts are kept)." });
    const by = result.writer === "groq" ? "the AI" : "the template";
    return ok({ message: `Wrote ${result.written} ${result.written === 1 ? "post" : "posts"} with ${by}.${result.note ? ` ${result.note}` : ""}` });
  } catch (error) {
    logger.error("marketing.content_write_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't write the posts. Try again.");
  }
}

const editInput = postInput.extend({
  text: z.string().max(6_000),
  title: z.string().max(400).nullable().optional(),
  script: z.string().max(4_000).nullable().optional(),
});

/** Saves the founder's edit of a draft. */
export async function savePostAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = editInput.safeParse(raw);
  if (!parsed.success) return err("Check the text and try again.");
  if (!(await takeRateLimit(rateLimitKey("admin-content-edit", admin.id), 60, 10))) return err(SLOW_DOWN);
  try {
    const post = await getPost(parsed.data.postId);
    if (!post) return err(NOT_FOUND);
    const text = cleanPostText(post.platform, parsed.data.text);
    if (text.length < 5) return err("The post is empty.");
    const fields: { text: string; title?: string | null; script?: string | null } = { text };
    if (post.platform === "youtube") {
      fields.title = (parsed.data.title ?? "").replace(/\s+/g, " ").trim().slice(0, CONTENT_LIMITS.youtubeTitle) || post.title;
      fields.script = cleanPostText("youtube", parsed.data.script ?? "").slice(0, CONTENT_LIMITS.youtubeScript) || post.script;
    }
    if (!(await updatePostText(post._id, fields))) return err("Only a draft can be edited. Move it back to draft first.");
    revalidatePath(CONTENT_PATH);
    return ok({ message: "Saved." });
  } catch (error) {
    logger.error("marketing.content_save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
}

/** Marks a draft as posted, with the link to the live post when given. */
export async function markPostedAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = postInput.extend({ url: z.string().max(500) }).safeParse(raw);
  if (!parsed.success) return err(NOT_FOUND);
  if (!(await takeRateLimit(rateLimitKey("admin-content-edit", admin.id), 60, 10))) return err(SLOW_DOWN);
  try {
    const post = await getPost(parsed.data.postId);
    if (!post) return err(NOT_FOUND);
    const url = parsed.data.url.trim();
    if (url && !postedUrlOk(post.platform, url)) return err("Paste the https link of the post itself, or leave the link empty.");
    if (!(await markPostPosted(post._id, url || null))) return err("Only a draft can be marked as posted.");
    revalidatePath(CONTENT_PATH);
    return ok({ message: "Marked as posted." });
  } catch (error) {
    logger.error("marketing.content_posted_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save that. Try again.");
  }
}

/** Skips a draft, or moves a skipped or posted post back to draft. */
export async function setPostStatusAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = postInput.extend({ status: z.enum(["skipped", "draft"]) }).safeParse(raw);
  if (!parsed.success) return err(NOT_FOUND);
  if (!(await takeRateLimit(rateLimitKey("admin-content-edit", admin.id), 60, 10))) return err(SLOW_DOWN);
  try {
    if (!(await setPostStatus(parsed.data.postId, parsed.data.status))) return err("This post can't change that way.");
    revalidatePath(CONTENT_PATH);
    return ok({ message: parsed.data.status === "skipped" ? "Skipped." : "Back to draft." });
  } catch (error) {
    logger.error("marketing.content_status_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save that. Try again.");
  }
}

/** Saves which platforms get posts, the real-numbers switch and the founder's weekly update. */
export async function saveContentSettingsAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = contentSettingsInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  if (!(await takeRateLimit(rateLimitKey("admin-content-edit", admin.id), 60, 10))) return err(SLOW_DOWN);
  try {
    await saveContentSettings(parsed.data);
    revalidatePath(CONTENT_PATH);
    return ok({ message: "Content settings saved." });
  } catch (error) {
    logger.error("marketing.content_settings_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save the settings. Try again.");
  }
}

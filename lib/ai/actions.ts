"use server";

import { aiSystemPrompt, aiUserPrompt, aiWriteInput, tidyAiResult, type AiWriteResult } from "@/lib/ai/creator-writer";
import { groqSubjectBody } from "@/lib/ai/groq-text";
import { requireCreator } from "@/lib/auth/guards";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { GroqError } from "@/lib/marketing/ai/groq-writer";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// The AI writing helper (D-131) for the signed-in creator. It only returns text for the creator to
// read and edit; it never saves anything. Limited per creator (20 an hour) and per store (60 a day).

export async function writeWithAiAction(raw: unknown): Promise<Result<AiWriteResult>> {
  const { user, store } = await requireCreator("/dashboard");
  const parsed = aiWriteInput.safeParse(raw);
  if (!parsed.success) return err("Check what you asked for and try again.");
  if (!serverEnv.GROQ_API_KEY) return err("The AI writer isn't turned on yet.");
  if (!(await takeRateLimit(rateLimitKey("ai-write:user", user.id), 20, 60))) return err("You've used the AI writer a lot this hour. Try again later.");
  if (!(await takeRateLimit(rateLimitKey("ai-write:store", store.id), 60, 24 * 60))) return err("You've reached today's AI writer limit. Try again tomorrow.");

  try {
    const answer = await groqSubjectBody({ apiKey: serverEnv.GROQ_API_KEY, model: serverEnv.GROQ_MODEL, system: aiSystemPrompt(parsed.data.kind), user: aiUserPrompt(parsed.data) });
    const result = tidyAiResult(parsed.data.kind, answer);
    if (!result) return err("The AI didn't write anything useful. Try again or add a note.");
    return ok(result);
  } catch (error) {
    logger.warn("ai_writer.failed", { kind: error instanceof GroqError ? error.kind : error instanceof Error ? error.name : undefined });
    return err(error instanceof GroqError && error.kind === "rate_limited" ? "The AI is busy right now. Try again in a minute." : "The AI writer isn't available right now. Try again soon.");
  }
}

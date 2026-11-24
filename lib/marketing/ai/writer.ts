import "server-only";

import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { draftProblem, tidyMessage } from "@/lib/marketing/ai/checks";
import { GroqError, GROQ_DEFAULT_MODEL, groqWriter } from "@/lib/marketing/ai/groq-writer";
import { templateDraft, templateWriter } from "@/lib/marketing/ai/template-writer";
import type { DraftInput, DraftResult, DraftWriter } from "@/lib/marketing/ai/types";

// Picks the DM draft writer (D-121): MARKETING_AI_PROVIDER = "template" (default) or "groq" with
// GROQ_API_KEY. Claude is added later as one more writer here; nothing else changes.

export function configuredWriter(env: Pick<typeof serverEnv, "MARKETING_AI_PROVIDER" | "GROQ_API_KEY" | "GROQ_MODEL"> = serverEnv): DraftWriter {
  if (env.MARKETING_AI_PROVIDER === "groq" && env.GROQ_API_KEY) return groqWriter(env.GROQ_API_KEY, env.GROQ_MODEL ?? GROQ_DEFAULT_MODEL);
  return templateWriter;
}

export type WrittenDraft = DraftResult & { note: string | null };

/**
 * A draft from the writer, checked against the honesty rules. A failing or broken AI draft is tried
 * once more, then replaced by the template; `note` says why, in words safe to show the founder.
 */
export async function writeDraft(input: DraftInput, writer: DraftWriter = configuredWriter()): Promise<WrittenDraft> {
  const fallback = (note: string): WrittenDraft => ({ ...templateDraft(input), writer: "template", model: null, note });
  if (writer.name === "template") return { ...templateDraft(input), writer: "template", model: null, note: null };

  let lastProblem = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await writer.write(input);
      const pair = { firstMessage: tidyMessage(raw.firstMessage), followUp: tidyMessage(raw.followUp) };
      const problem = draftProblem(pair);
      if (!problem) return { ...pair, writer: writer.name, model: writer.model, note: null };
      lastProblem = problem;
    } catch (error) {
      if (error instanceof GroqError) {
        logger.warn("marketing.draft_writer_failed", { kind: error.kind });
        // Limits and a wrong key do not get better with a retry.
        if (error.kind === "rate_limited" || error.kind === "unauthorized") return fallback(`${error.message} Used the template instead.`);
        lastProblem = error.message;
      } else {
        logger.error("marketing.draft_writer_error", { name: error instanceof Error ? error.name : undefined });
        lastProblem = "The AI writer failed.";
      }
    }
  }
  return fallback(`AI draft not usable (${lastProblem.replace(/\.$/, "")}). Used the template instead.`);
}

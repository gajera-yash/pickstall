import "server-only";

import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { GroqError, GROQ_DEFAULT_MODEL, groqJson } from "@/lib/marketing/ai/groq-writer";
import type { WriterName } from "@/lib/marketing/ai/types";
import { contentSystemPrompt, contentUserPrompt } from "@/lib/marketing/content/prompt";
import { allowedNumbers, contentSetProblem, contentSetSchema, tidySet, type ContentBrief, type ContentSet } from "@/lib/marketing/content/rules";
import { templateContent } from "@/lib/marketing/content/template";

// Picks the content writer (D-136), the same switch as DM drafts (D-121): MARKETING_AI_PROVIDER =
// "groq" with GROQ_API_KEY, otherwise the template. Every AI set is checked; a failing one is tried
// once more, then replaced by the template, with a note the founder can read.

export type ContentWriter = { name: WriterName; model: string | null; write: (brief: ContentBrief) => Promise<ContentSet> };

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    slides: { type: "array", items: { type: "string" } },
    x: { type: "string" },
    linkedin: { type: "string" },
    instagram: { type: "string" },
    facebook: { type: "string" },
    youtubeTitle: { type: "string" },
    youtubeDescription: { type: "string" },
    youtubeScript: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "slides", "x", "linkedin", "instagram", "facebook", "youtubeTitle", "youtubeDescription", "youtubeScript", "hashtags"],
  additionalProperties: false,
} as const;

export function groqContentWriter(apiKey: string, model: string = GROQ_DEFAULT_MODEL, fetchImpl: typeof fetch = fetch): ContentWriter {
  return {
    name: "groq",
    model,
    write: async (brief) => {
      const parsed = await groqJson({
        apiKey,
        model,
        system: contentSystemPrompt(brief.voiceExamples),
        user: contentUserPrompt(brief),
        schemaName: "daily_posts",
        schema: SCHEMA,
        maxTokens: 4_000,
        timeoutMs: 45_000,
        fetchImpl,
      });
      const set = contentSetSchema.safeParse(parsed);
      if (!set.success) throw new GroqError("bad_response", "Groq's answer had the wrong shape.");
      return set.data;
    },
  };
}

export const templateContentWriter: ContentWriter = { name: "template", model: null, write: async (brief) => templateContent(brief) };

export function configuredContentWriter(env: Pick<typeof serverEnv, "MARKETING_AI_PROVIDER" | "GROQ_API_KEY" | "GROQ_MODEL"> = serverEnv): ContentWriter {
  if (env.MARKETING_AI_PROVIDER === "groq" && env.GROQ_API_KEY) return groqContentWriter(env.GROQ_API_KEY, env.GROQ_MODEL ?? GROQ_DEFAULT_MODEL);
  return templateContentWriter;
}

export type WrittenContent = { set: ContentSet; writer: WriterName; model: string | null; note: string | null };

/** A checked content set from the writer, or the template with a note saying why. */
export async function writeContent(brief: ContentBrief, writer: ContentWriter = configuredContentWriter()): Promise<WrittenContent> {
  const template = (note: string | null): WrittenContent => ({ set: tidySet(templateContent(brief)), writer: "template", model: null, note });
  if (writer.name === "template") return template(null);

  const allowed = allowedNumbers(brief);
  let lastProblem = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const set = tidySet(await writer.write(brief));
      const problem = contentSetProblem(set, allowed);
      if (!problem) return { set, writer: writer.name, model: writer.model, note: null };
      lastProblem = problem;
    } catch (error) {
      if (error instanceof GroqError) {
        logger.warn("marketing.content_writer_failed", { kind: error.kind });
        if (error.kind === "rate_limited" || error.kind === "unauthorized") return template(`${error.message} Used the template instead.`);
        lastProblem = error.message;
      } else {
        logger.error("marketing.content_writer_error", { name: error instanceof Error ? error.name : undefined });
        lastProblem = "The AI writer failed.";
      }
    }
  }
  return template(`AI posts not usable (${lastProblem.replace(/\.$/, "")}). Used the template instead.`);
}

import "server-only";

import { z } from "zod";

import { draftPairSchema } from "@/lib/marketing/ai/checks";
import { draftSystemPrompt, draftUserPrompt } from "@/lib/marketing/ai/prompt";
import type { DraftPair, DraftWriter } from "@/lib/marketing/ai/types";

// DM drafts through Groq (D-121), with plain fetch (no SDK dependency). Endpoint, auth header and
// body fields from https://console.groq.com/docs/api-reference; strict JSON schema output from
// https://console.groq.com/docs/structured-outputs (supported on the gpt-oss models), checked
// 2026-11-23. The key is server-only and never logged.

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 25_000;

/** A Groq failure the caller can explain without leaking details. */
export class GroqError extends Error {
  constructor(
    readonly kind: "rate_limited" | "unauthorized" | "bad_response" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

const JSON_SCHEMA = {
  type: "object",
  properties: { firstMessage: { type: "string" }, followUp: { type: "string" } },
  required: ["firstMessage", "followUp"],
  additionalProperties: false,
} as const;

const completion = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

export type GroqJsonRequest = {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/** One chat completion with a strict JSON schema; returns the parsed JSON (shape not checked yet). */
export async function groqJson(request: GroqJsonRequest): Promise<unknown> {
  const { apiKey, model, fetchImpl = fetch } = request;
  let response: Response;
  try {
    response = await fetchImpl(GROQ_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        temperature: 0.7,
        max_completion_tokens: request.maxTokens ?? 2_000,
        reasoning_effort: "low",
        response_format: { type: "json_schema", json_schema: { name: request.schemaName, strict: true, schema: request.schema } },
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? TIMEOUT_MS),
    });
  } catch {
    throw new GroqError("unavailable", "Groq did not answer in time.");
  }
  if (response.status === 429) throw new GroqError("rate_limited", "Groq's free limit is used up for now.");
  if (response.status === 401 || response.status === 403) throw new GroqError("unauthorized", "Groq refused the API key.");
  if (!response.ok) throw new GroqError("unavailable", `Groq answered ${response.status}.`);

  const body = completion.safeParse(await response.json().catch(() => null));
  const content = body.success ? body.data.choices[0]?.message.content : null;
  if (!content) throw new GroqError("bad_response", "Groq sent an empty answer.");
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new GroqError("bad_response", "Groq's answer was not JSON.");
  }
}

/** A writer that calls Groq's chat completions with the given key and model. */
export function groqWriter(apiKey: string, model: string = GROQ_DEFAULT_MODEL, fetchImpl: typeof fetch = fetch): DraftWriter {
  return {
    name: "groq",
    model,
    write: async (input): Promise<DraftPair> => {
      const parsed = await groqJson({
        apiKey,
        model,
        system: draftSystemPrompt(input.voiceExamples),
        user: draftUserPrompt(input),
        schemaName: "dm_draft",
        schema: JSON_SCHEMA,
        fetchImpl,
      });
      const pair = draftPairSchema.safeParse(parsed);
      if (!pair.success) throw new GroqError("bad_response", "Groq's answer had the wrong shape.");
      return pair.data;
    },
  };
}

import "server-only";

import { z } from "zod";

import { GROQ_DEFAULT_MODEL, GROQ_ENDPOINT, GroqError } from "@/lib/marketing/ai/groq-writer";

// One Groq chat completion that returns {subject, body} as strict JSON (D-131), with plain fetch,
// the same endpoint and structured outputs as the DM drafts (D-121). The key is never logged.

const TIMEOUT_MS = 25_000;
const SCHEMA = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
  additionalProperties: false,
} as const;
const completion = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1) });

export async function groqSubjectBody(
  { apiKey, model = GROQ_DEFAULT_MODEL, system, user }: { apiKey: string; model?: string; system: string; user: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ subject: unknown; body: unknown }> {
  let response: Response;
  try {
    response = await fetchImpl(GROQ_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_completion_tokens: 3_000,
        reasoning_effort: "low",
        response_format: { type: "json_schema", json_schema: { name: "creator_text", strict: true, schema: SCHEMA } },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new GroqError("unavailable", "The AI did not answer in time.");
  }
  if (response.status === 429) throw new GroqError("rate_limited", "The AI is busy right now.");
  if (response.status === 401 || response.status === 403) throw new GroqError("unauthorized", "The AI key was refused.");
  if (!response.ok) throw new GroqError("unavailable", `The AI answered ${response.status}.`);
  const body = completion.safeParse(await response.json().catch(() => null));
  const content = body.success ? body.data.choices[0]?.message.content : null;
  if (!content) throw new GroqError("bad_response", "The AI sent an empty answer.");
  try {
    const parsed = JSON.parse(content) as { subject?: unknown; body?: unknown };
    return { subject: parsed.subject, body: parsed.body };
  } catch {
    throw new GroqError("bad_response", "The AI's answer was not JSON.");
  }
}

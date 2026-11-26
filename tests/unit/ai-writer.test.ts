import { beforeEach, describe, expect, it, vi } from "vitest";

// D-131: the AI writing helper's rules, the Groq call and the action's limits.

const env = vi.hoisted(() => ({ serverEnv: { GROQ_API_KEY: "gsk_test_key_123456789012345" as string | undefined, GROQ_MODEL: undefined } }));
const limits = vi.hoisted(() => ({ takeRateLimit: vi.fn(async () => true), rateLimitKey: (a: string, b: string) => `${a}:${b}` }));
const groq = vi.hoisted(() => ({ groqSubjectBody: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => env);
vi.mock("@/lib/rate-limit", () => limits);
vi.mock("@/lib/ai/groq-text", () => groq);
vi.mock("@/lib/auth/guards", () => ({ requireCreator: vi.fn(async () => ({ user: { id: "user-a" }, store: { id: "store-a" } })) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { writeWithAiAction } from "@/lib/ai/actions";
import { aiSystemPrompt, aiUserPrompt, aiWriteInput, tidyAiResult } from "@/lib/ai/creator-writer";
import { GroqError } from "@/lib/marketing/ai/groq-writer";

const input = { kind: "cart", title: "Budget workbook", notes: "", current: "", tone: "friendly" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  env.serverEnv.GROQ_API_KEY = "gsk_test_key_123456789012345";
  limits.takeRateLimit.mockResolvedValue(true);
});

describe("AI writer rules", () => {
  it("tells the AI which placeholders it may use and never to invent facts", () => {
    expect(aiSystemPrompt("confirmation")).toContain("{{download_link}}");
    expect(aiSystemPrompt("welcome")).not.toContain("{{product_title}}");
    expect(aiSystemPrompt("description")).toContain("Do not use any {{...}} placeholders");
    expect(aiSystemPrompt("broadcast")).toContain("Never invent facts");
    expect(aiUserPrompt(aiWriteInput.parse(input))).toContain("Budget workbook");
  });

  it("cleans the answer: plain text, length limits and only allowed placeholders", () => {
    const result = tidyAiResult("cart", { subject: "Hi {{customer_name}} <b>now</b>\n", body: "Get **{{product_title}}** at {{download_link}} {{secret}} <script>x</script>" });
    expect(result).toEqual({ subject: "Hi {{customer_name}} now", body: "Get {{product_title}} at   x" });
    expect(tidyAiResult("description", { subject: "ignored", body: "x".repeat(3000) })?.body).toHaveLength(2000);
    expect(tidyAiResult("description", { subject: "", body: "   " })).toBeNull();
    expect(tidyAiResult("welcome", { subject: 5, body: "Hello" })).toEqual({ subject: null, body: "Hello" });
  });

  it("rejects unknown kinds and over-long notes are cut", () => {
    expect(aiWriteInput.safeParse({ ...input, kind: "sql" }).success).toBe(false);
    expect(aiWriteInput.parse({ ...input, notes: "a".repeat(800) }).notes).toHaveLength(500);
  });
});

describe("writeWithAiAction", () => {
  it("returns cleaned text for the creator to edit", async () => {
    groq.groqSubjectBody.mockResolvedValue({ subject: "Still thinking?", body: "Hi {{customer_name}}, your {{product_title}} is waiting." });
    const result = await writeWithAiAction(input);
    expect(result).toEqual({ ok: true, data: { subject: "Still thinking?", body: "Hi {{customer_name}}, your {{product_title}} is waiting." } });
    expect(limits.takeRateLimit).toHaveBeenCalledWith("ai-write:user:user-a", 20, 60);
    expect(limits.takeRateLimit).toHaveBeenCalledWith("ai-write:store:store-a", 60, 1440);
  });

  it("says so when the AI is not set up, rate limited or failing", async () => {
    env.serverEnv.GROQ_API_KEY = undefined;
    expect(await writeWithAiAction(input)).toMatchObject({ ok: false, error: "The AI writer isn't turned on yet." });
    env.serverEnv.GROQ_API_KEY = "gsk_test_key_123456789012345";
    limits.takeRateLimit.mockResolvedValueOnce(false);
    expect((await writeWithAiAction(input)).ok).toBe(false);
    groq.groqSubjectBody.mockRejectedValueOnce(new GroqError("rate_limited", "busy"));
    expect(await writeWithAiAction(input)).toMatchObject({ ok: false, error: "The AI is busy right now. Try again in a minute." });
    expect(groq.groqSubjectBody).toHaveBeenCalledTimes(1);
  });
});

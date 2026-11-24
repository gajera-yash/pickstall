import { beforeEach, describe, expect, it, vi } from "vitest";

// D-121: fit score, draft honesty checks, the template and Groq writers, the fallback rules, and
// the admin guard on draft actions.

const guard = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const drafts = vi.hoisted(() => ({ createDraft: vi.fn(), markFollowUpSent: vi.fn(), saveGrowthSettings: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => guard);
vi.mock("@/lib/marketing/drafts", () => drafts);
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (...parts: string[]) => parts.join(":"), takeRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { draftProblem, messageProblem } from "@/lib/marketing/ai/checks";
import { GROQ_ENDPOINT, GroqError, groqWriter } from "@/lib/marketing/ai/groq-writer";
import { draftSystemPrompt, draftUserPrompt } from "@/lib/marketing/ai/prompt";
import { templateDraft } from "@/lib/marketing/ai/template-writer";
import type { DraftInput, DraftWriter } from "@/lib/marketing/ai/types";
import { configuredWriter, writeDraft } from "@/lib/marketing/ai/writer";
import { markFollowUpSentAction, saveGrowthSettingsAction, writeDraftAction } from "@/lib/marketing/draft-actions";
import { followerBand, leadFit } from "@/lib/marketing/fit";
import { firstNameOf, growthSettingsInput } from "@/lib/marketing/growth-settings-rules";
import { LEAD_TOOLS } from "@/lib/marketing/leads-rules";

const LEAD = "44444444-4444-4444-8444-444444444444";
const input: DraftInput = { firstName: "Maya", topic: "Notion templates", tool: "stan", toolLabel: "Stan Store", followerBand: "10K-50K", country: "USA", voiceExamples: [] };
const good = { firstMessage: "Hey Maya! Loved your Notion templates. Are you still on Stan Store? Pickstall Pro has the same tools for $39. Want a quick look?", followUp: "No worries if now isn't the time, Maya. Happy to show you an example store." };

describe("fit score", () => {
  it("ranks a Stan creator with 1K-50K followers in the US highest", () => {
    const fit = leadFit({ tool: "stan", followers: 12_000, country: "USA", topic: "Notion" });
    expect(fit.score).toBe(85);
    expect(fit.reasons).toContain("Uses Stan Store: Pickstall Pro is $39 vs $99");
    expect(fit.warning).toBeNull();
  });

  it("warns about creators in India and scores unknowns low", () => {
    expect(leadFit({ tool: "linktree", followers: 5_000, country: "India", topic: null }).warning).toMatch(/PayPal India/);
    expect(leadFit({ tool: "other", followers: null, country: null, topic: null }).score).toBe(0);
    expect(leadFit({ tool: "stan", followers: 900_000, country: "UK", topic: "Art" }).score).toBe(65);
  });

  it("turns followers into a range and names into a first name", () => {
    expect(followerBand(12_500)).toBe("10K-50K");
    expect(followerBand(null)).toBeNull();
    expect(firstNameOf("Maya Patel")).toBe("Maya");
    expect(firstNameOf("🌸 Ria")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });
});

describe("draft checks", () => {
  it("accepts a plain, honest message", () => {
    expect(draftProblem(good)).toBeNull();
  });

  it("refuses links, emails, placeholders, tax, card checkout and a bare 0%", () => {
    expect(messageProblem("Check it out at pickstall.store, it is great for creators like you")).toBe("contains a link");
    expect(messageProblem("Email me at hello@example.com and I will set it up for you")).toBe("contains an email address");
    expect(messageProblem("Hey [Name], I loved your content and wanted to reach out today")).toBe("contains a placeholder or markup");
    expect(messageProblem("We handle your sales tax so you never have to think about it")).toBe("mentions tax");
    expect(messageProblem("Your buyers can pay with Apple Pay in one tap on any phone")).toBe("promises a checkout we do not offer");
    expect(messageProblem("Pickstall has 0% transaction fees, so you keep everything you earn")).toMatch(/0%/);
    expect(messageProblem("Pickstall has 0% transaction fees; PayPal's normal processing fee still applies.")).toBeNull();
    expect(messageProblem("x".repeat(601))).toMatch(/over 600/);
  });

  it("every template passes the checks, for every tool", () => {
    for (const tool of LEAD_TOOLS) {
      for (const firstName of ["Maya", null]) {
        const draft = templateDraft({ ...input, tool, firstName, topic: firstName ? "Notion templates" : null });
        expect(draftProblem(draft), `${tool} ${firstName}`).toBeNull();
      }
    }
  });
});

describe("prompts", () => {
  it("send only the allowed facts and details, never a handle", () => {
    const system = draftSystemPrompt(["hey! loved your reels"]);
    expect(system).toContain("$39");
    expect(system).toContain("PayPal");
    expect(system).toContain("loved your reels");
    const user = draftUserPrompt(input);
    expect(user).toContain("First name: Maya");
    expect(user).toContain("Followers: 10K-50K");
    expect(user).not.toMatch(/@|handle/i);
  });
});

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("Groq writer", () => {
  it("asks for strict JSON with the key and model, and reads the answer", async () => {
    const fetchMock = fakeFetch(200, { choices: [{ message: { content: JSON.stringify(good) } }] });
    const pair = await groqWriter("gsk_test_key_0123456789abcdef", "openai/gpt-oss-120b", fetchMock as unknown as typeof fetch).write(input);
    expect(pair).toEqual(good);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_ENDPOINT);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gsk_test_key_0123456789abcdef");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[1].content).not.toContain("@");
  });

  it("names rate limits, refused keys and broken answers", async () => {
    const writer = (status: number, body: unknown) => groqWriter("gsk_test_key_0123456789abcdef", "m", fakeFetch(status, body) as unknown as typeof fetch);
    await expect(writer(429, {}).write(input)).rejects.toMatchObject({ kind: "rate_limited" });
    await expect(writer(401, {}).write(input)).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(writer(200, { choices: [{ message: { content: "not json" } }] }).write(input)).rejects.toMatchObject({ kind: "bad_response" });
    await expect(writer(200, { choices: [{ message: { content: JSON.stringify({ firstMessage: "hi" }) } }] }).write(input)).rejects.toMatchObject({ kind: "bad_response" });
  });
});

describe("writeDraft", () => {
  const writerOf = (write: DraftWriter["write"]): DraftWriter => ({ name: "groq", model: "m", write: vi.fn(write) });

  it("keeps a good AI draft", async () => {
    expect(await writeDraft(input, writerOf(async () => good))).toEqual({ ...good, writer: "groq", model: "m", note: null });
  });

  it("tries a rule-breaking draft once more, then uses the template with a note", async () => {
    const writer = writerOf(async () => ({ ...good, firstMessage: "Visit pickstall.store right now, it is the best store for you" }));
    const result = await writeDraft(input, writer);
    expect(writer.write).toHaveBeenCalledTimes(2);
    expect(result.writer).toBe("template");
    expect(result.note).toMatch(/contains a link/);
    expect(result.firstMessage).toBe(templateDraft(input).firstMessage);
  });

  it("goes straight to the template on a rate limit", async () => {
    const writer = writerOf(async () => {
      throw new GroqError("rate_limited", "Groq's free limit is used up for now.");
    });
    const result = await writeDraft(input, writer);
    expect(writer.write).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ writer: "template", note: expect.stringMatching(/free limit/) });
  });

  it("uses the template unless Groq is chosen and has a key", () => {
    expect(configuredWriter({ MARKETING_AI_PROVIDER: undefined, GROQ_API_KEY: "gsk_test_key_0123456789abcdef", GROQ_MODEL: undefined }).name).toBe("template");
    expect(configuredWriter({ MARKETING_AI_PROVIDER: "groq", GROQ_API_KEY: undefined, GROQ_MODEL: undefined }).name).toBe("template");
    expect(configuredWriter({ MARKETING_AI_PROVIDER: "groq", GROQ_API_KEY: "gsk_test_key_0123456789abcdef", GROQ_MODEL: undefined })).toMatchObject({ name: "groq", model: "openai/gpt-oss-120b" });
  });
});

describe("growth settings", () => {
  it("cleans voice examples and checks the limits", () => {
    const parsed = growthSettingsInput.parse({ voiceExamples: ["  hey <b>there</b>  ", ""], dailyDraftLimit: 30, dailyContactTarget: 15 });
    expect(parsed.voiceExamples).toEqual(["hey there"]);
    expect(growthSettingsInput.safeParse({ voiceExamples: [], dailyDraftLimit: 0, dailyContactTarget: 15 }).success).toBe(false);
    expect(growthSettingsInput.safeParse({ voiceExamples: ["a", "b", "c", "d", "e"], dailyDraftLimit: 5, dailyContactTarget: 5 }).success).toBe(false);
  });
});

describe("draft actions need an admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
  });

  it("refuses every action without an admin session", async () => {
    await expect(writeDraftAction({ leadId: LEAD })).rejects.toThrow("NEXT_REDIRECT");
    await expect(markFollowUpSentAction({ leadId: LEAD })).rejects.toThrow("NEXT_REDIRECT");
    await expect(saveGrowthSettingsAction({ voiceExamples: [], dailyDraftLimit: 10, dailyContactTarget: 10 })).rejects.toThrow("NEXT_REDIRECT");
    expect(drafts.createDraft).not.toHaveBeenCalled();
  });

  it("explains the daily limit", async () => {
    guard.requireAdmin.mockResolvedValue({ id: "admin", username: "founder" });
    drafts.createDraft.mockResolvedValue({ ok: false, reason: "limit" });
    expect(await writeDraftAction({ leadId: LEAD })).toMatchObject({ ok: false, error: expect.stringMatching(/draft limit/) });
    expect(drafts.createDraft).toHaveBeenCalledWith(LEAD, "admin:founder");
  });
});

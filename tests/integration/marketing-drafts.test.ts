import { describe, expect, it } from "vitest";

// D-121 on a real MongoDB: drafts are saved within the daily limit, the Today queue ranks new leads
// by fit, and follow-ups come due once, 4 days after contact.

import { collections } from "@/lib/db/collections";
import { templateWriter } from "@/lib/marketing/ai/template-writer";
import { createDraft, latestDrafts, markFollowUpSent, saveGrowthSettings, todayQueue } from "@/lib/marketing/drafts";
import { deleteLead, importLeads, markLeadContacted, setLeadStage } from "@/lib/marketing/leads";

const ACTOR = "admin:founder";
const DAY = 24 * 60 * 60 * 1000;
const base = { fileName: "creators.csv", firstRow: 2, statusMap: {} };

async function leadId(handle: string): Promise<string> {
  const { mktLeads } = await collections();
  const lead = await mktLeads.findOne({ handle });
  if (!lead) throw new Error(`no lead ${handle}`);
  return lead._id;
}

describe("drafts and the Today queue", () => {
  it("saves drafts, keeps the daily limit, ranks by fit and handles follow-ups", async () => {
    await saveGrowthSettings({ voiceExamples: [], dailyDraftLimit: 3, dailyContactTarget: 2 });
    await importLeads(
      {
        ...base,
        rows: [
          { name: "Best Fit", handle: "best.fit", tool: "Stan Store", followers: "12K", country: "USA", topic: "Notion" },
          { name: "Good Fit", handle: "good.fit", tool: "Linktree", followers: "8K", country: "UK" },
          { name: "Low Fit", handle: "low.fit", tool: "Selar", followers: "900" },
          { name: "Blocked", handle: "blocked.fit", tool: "Stan Store", status: "Do not contact" },
        ],
      },
      ACTOR,
    );
    const best = await leadId("best.fit");
    const good = await leadId("good.fit");

    const queue = await todayQueue();
    expect(queue.toContact.map((lead) => lead.handle)).toEqual(["best.fit", "good.fit"]);
    expect(queue.toContact[0]?.fit.score).toBeGreaterThan(queue.toContact[1]?.fit.score ?? 0);

    const first = await createDraft(best, ACTOR, new Date(), templateWriter);
    expect(first).toMatchObject({ ok: true, draft: { leadId: best, writer: "template", model: null } });
    expect(await createDraft(await leadId("blocked.fit"), ACTOR, new Date(), templateWriter)).toEqual({ ok: false, reason: "do_not_contact" });
    await createDraft(best, ACTOR, new Date(), templateWriter);
    await createDraft(good, ACTOR, new Date(), templateWriter);
    expect(await createDraft(good, ACTOR, new Date(), templateWriter)).toEqual({ ok: false, reason: "limit" });
    expect((await latestDrafts([best])).get(best)?.firstMessage).toContain("Stan Store");

    // Contacting one lead today leaves room for one more in today's target.
    await markLeadContacted(best, ACTOR);
    const after = await todayQueue();
    expect(after.contactedToday).toBe(1);
    expect(after.toContact.map((lead) => lead.handle)).toEqual(["good.fit"]);
    expect(after.toContact[0]?.draft?.leadId).toBe(good);

    // The follow-up is due 4 days later, once; 4 days after it, the lead shows as no reply.
    const later = new Date(Date.now() + 4 * DAY + 60_000);
    expect((await todayQueue(later)).followUps.map((lead) => lead.handle)).toEqual(["best.fit"]);
    expect(await markFollowUpSent(best, ACTOR, later)).toBe(true);
    expect(await markFollowUpSent(best, ACTOR, later)).toBe(false);
    expect((await todayQueue(later)).followUps).toHaveLength(0);
    const muchLater = new Date(later.getTime() + 4 * DAY + 60_000);
    expect((await todayQueue(muchLater)).noReply.map((lead) => lead.handle)).toEqual(["best.fit"]);

    // A reply takes the lead out of follow-ups and "no reply".
    await setLeadStage(best, "replied", ACTOR);
    expect((await todayQueue(muchLater)).noReply).toHaveLength(0);
  });

  it("deletes a lead's drafts with the lead", async () => {
    await saveGrowthSettings({ voiceExamples: [], dailyDraftLimit: 100, dailyContactTarget: 10 });
    await importLeads({ ...base, rows: [{ handle: "delete.drafts" }] }, ACTOR);
    const id = await leadId("delete.drafts");
    await createDraft(id, ACTOR, new Date(), templateWriter);
    await deleteLead(id);
    const { mktDrafts } = await collections();
    expect(await mktDrafts.countDocuments({ leadId: id })).toBe(0);
  });
});

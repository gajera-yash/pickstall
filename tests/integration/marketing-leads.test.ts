import { describe, expect, it } from "vitest";

// D-120 on a real MongoDB: importing the founder's list, stages and suppression, and finding a lead's
// store by their own link or by the same profile on the store.

import { collections } from "@/lib/db/collections";
import { deleteLead, getLead, importLeads, listLeads, markLeadContacted, setLeadStage, suppressionId } from "@/lib/marketing/leads";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

const ACTOR = "admin:founder";
const noMap = { fileName: "creators.csv", firstRow: 2, statusMap: {} };

async function leadByHandle(handle: string) {
  const { mktLeads } = await collections();
  const lead = await mktLeads.findOne({ handle });
  if (!lead) throw new Error(`no lead ${handle}`);
  return lead;
}

describe("importLeads", () => {
  it("adds valid rows once, with a random code, and reports the rest", async () => {
    const summary = await importLeads(
      {
        ...noMap,
        statusMap: { "dm sent": "contacted" },
        rows: [
          { name: "Maya", handle: "@maya.makes", followers: "12.5K", tool: "Stan Store", status: "DM sent" },
          { name: "No handle", handle: "" },
          { name: "Maya again", handle: "https://www.instagram.com/maya.makes" },
          { name: "Ria", handle: "study.with.ria", platform: "TikTok", status: "" },
        ],
      },
      ACTOR,
    );
    expect(summary).toEqual({ added: 2, existing: 1, suppressed: 0, invalid: 1, invalidRows: [3], failed: 0 });
    const maya = await leadByHandle("maya.makes");
    expect(maya).toMatchObject({ platform: "instagram", handleKey: "instagram:maya.makes", name: "Maya", followers: 12_500, tool: "stan", stage: "contacted", importedFrom: "creators.csv" });
    expect(maya.refCode).toMatch(/^[a-z2-9]{8}$/);
    expect(maya.refCode).not.toContain("maya");
    expect((await leadByHandle("study.with.ria")).platform).toBe("tiktok");

    const again = await importLeads({ ...noMap, rows: [{ name: "Changed", handle: "maya.makes" }] }, ACTOR);
    expect(again).toMatchObject({ added: 0, existing: 1 });
    expect((await leadByHandle("maya.makes")).name).toBe("Maya");
    const { mktEvents } = await collections();
    expect(await mktEvents.countDocuments({ leadId: maya._id, type: "imported" })).toBe(1);
  });

  it("never adds back a deleted or do-not-contact handle", async () => {
    await importLeads({ ...noMap, rows: [{ handle: "gone.creator" }, { handle: "quiet.creator" }] }, ACTOR);
    const gone = await leadByHandle("gone.creator");
    const quiet = await leadByHandle("quiet.creator");
    expect(await deleteLead(gone._id)).toBe(true);
    expect(await setLeadStage(quiet._id, "do_not_contact", ACTOR)).toBe(true);
    const { mktLeads, mktEvents, mktSuppressions } = await collections();
    expect(await mktLeads.findOne({ _id: gone._id })).toBeNull();
    expect(await mktEvents.countDocuments({ leadId: gone._id })).toBe(0);
    expect(await mktSuppressions.findOne({ _id: suppressionId("instagram:gone.creator") })).toMatchObject({ reason: "deleted" });

    await mktLeads.deleteOne({ _id: quiet._id });
    expect(await importLeads({ ...noMap, rows: [{ handle: "gone.creator" }, { handle: "@Quiet.Creator" }] }, ACTOR)).toMatchObject({ added: 0, suppressed: 2 });
  });
});

describe("stages", () => {
  it("records changes, marks contact, and lifts do-not-contact when moved back", async () => {
    await importLeads({ ...noMap, rows: [{ handle: "stage.test" }] }, ACTOR);
    const lead = await leadByHandle("stage.test");
    expect(await markLeadContacted(lead._id, ACTOR)).toBe(true);
    const contacted = await leadByHandle("stage.test");
    expect(contacted.stage).toBe("contacted");
    expect(contacted.lastContactedAt).toBeInstanceOf(Date);

    await setLeadStage(lead._id, "do_not_contact", ACTOR);
    expect(await markLeadContacted(lead._id, ACTOR)).toBe(false);
    const { mktSuppressions } = await collections();
    expect(await mktSuppressions.countDocuments({ _id: suppressionId("instagram:stage.test") })).toBe(1);
    await setLeadStage(lead._id, "interested", ACTOR);
    expect(await mktSuppressions.countDocuments({ _id: suppressionId("instagram:stage.test") })).toBe(0);

    const detail = await getLead(lead._id);
    // "Contacted" and its stage change share one time, so their order is not fixed.
    expect(detail?.events.map((event) => event.type).sort()).toEqual(["contacted", "imported", "stage_changed", "stage_changed", "stage_changed"]);
    expect(detail?.events[0]).toMatchObject({ from: "do_not_contact", to: "interested", actor: ACTOR });
  });
});

describe("a lead's store", () => {
  it("is found by their own link, or by the same profile on the store, with the store's steps", async () => {
    await importLeads({ ...noMap, rows: [{ handle: "linked.creator", followers: "50K" }, { handle: "profile.creator", followers: "40K" }, { handle: "waiting.creator", followers: "1K" }] }, ACTOR);
    const linked = await leadByHandle("linked.creator");
    const store = await seedStore({ isPublished: true, acquisition: { ref: linked.refCode, source: "outreach", medium: "instagram_dm", campaign: null, referrer: null } });
    await seedOrder(await seedProduct(store._id), { provider: "paypal" });
    await seedStore({ isPublished: false, socialLinks: [{ kind: "instagram", url: "https://www.instagram.com/profile.creator" }] });

    const page = await listLeads({ page: 0 });
    const byHandle = new Map(page.rows.map((row) => [row.handle, row]));
    expect(byHandle.get("linked.creator")?.store).toMatchObject({ storeId: store._id, via: "link", steps: { published: true, firstSale: true } });
    expect(byHandle.get("profile.creator")?.store).toMatchObject({ via: "profile", steps: { published: false } });
    expect(byHandle.get("waiting.creator")?.store).toBeNull();
    expect(page.counts.signedUp).toBe(2);
    expect(page.counts.firstSale).toBe(1);

    const signedUp = await listLeads({ page: 0, stage: "signed_up" });
    expect(signedUp.rows.map((row) => row.handle).sort()).toEqual(["linked.creator", "profile.creator"]);
    expect((await listLeads({ page: 0, q: "@waiting" })).rows.map((row) => row.handle)).toEqual(["waiting.creator"]);
  });
});

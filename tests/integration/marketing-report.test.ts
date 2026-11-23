import { describe, expect, it } from "vitest";

// D-122 on a real MongoDB: the report counts today's outreach and creators correctly, and the
// 21:00 email goes once while "Send now" previews never block it.

import { collections } from "@/lib/db/collections";
import { importLeads, markLeadContacted, setLeadStage } from "@/lib/marketing/leads";
import { buildDailyReport } from "@/lib/marketing/report";
import { reportWindow } from "@/lib/marketing/report-rules";
import { runDailyReport } from "@/lib/marketing/report-send";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

const ACTOR = "admin:founder";

describe("daily report", () => {
  it("counts outreach, signups by source, first sales and who moved", async () => {
    await importLeads(
      { fileName: "c.csv", firstRow: 2, statusMap: {}, rows: [{ name: "Maya", handle: "r.maya" }, { name: "Ria", handle: "r.ria" }, { name: "Old", handle: "r.old" }] },
      ACTOR,
    );
    const { mktLeads } = await collections();
    const maya = await mktLeads.findOne({ handle: "r.maya" });
    const ria = await mktLeads.findOne({ handle: "r.ria" });
    if (!maya || !ria) throw new Error("leads missing");
    await markLeadContacted(maya._id, ACTOR);
    await markLeadContacted(ria._id, ACTOR);
    await setLeadStage(ria._id, "replied", ACTOR);

    // Maya signs up through her link, publishes and makes a first sale; one direct signup too.
    const store = await seedStore({ isPublished: true, publishedAt: new Date(), acquisition: { ref: maya.refCode, source: "outreach", medium: "instagram_dm", campaign: null, referrer: null } });
    await seedOrder(await seedProduct(store._id), { provider: "paypal" });
    await seedStore({ isPublished: false });
    // A store with an older sale does not count as a first sale today.
    const older = await seedStore({ createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) });
    const olderProduct = await seedProduct(older._id);
    await seedOrder(olderProduct, { provider: "paypal", paidAt: new Date(Date.now() - 20 * 24 * 3600 * 1000) });
    await seedOrder(olderProduct, { provider: "paypal" });

    const window = { ...reportWindow(new Date()), end: new Date(Date.now() + 60_000) };
    const data = await buildDailyReport(window);
    expect(data.outreach).toMatchObject({ dmsSent: 2, replies: 1, imported: 3 });
    expect(data.funnel).toMatchObject({ signups: 2, published: 1, firstSales: 1 });
    expect(data.funnel.signupsBySource).toEqual(expect.arrayContaining([{ source: "outreach", count: 1 }, { source: "direct", count: 1 }]));
    expect(data.movements.map((row) => `${row.who}: ${row.what}`)).toEqual(expect.arrayContaining(["Maya: signed up through their link", "Ria: moved to Replied", "Maya: messaged"]));
    expect(data.trend).toHaveLength(7);
    expect(data.trend.at(-1)).toMatchObject({ dms: 2, replies: 1 });
    expect(data.priorities.length).toBeGreaterThan(0);
  });

  it("emails the 21:00 report once; previews never block it", async () => {
    const now = new Date();
    expect(await runDailyReport(now, { mode: "scheduled", recipient: undefined })).toMatchObject({ outcome: "no_recipient" });
    expect(await runDailyReport(now, { mode: "preview", recipient: "founder@example.com" })).toMatchObject({ outcome: "sent" });
    const { mktReports } = await collections();
    const day = reportWindow(now).day;
    expect((await mktReports.findOne({ _id: day }))?.emailedAt).toBeUndefined();
    expect(await runDailyReport(now, { mode: "scheduled", recipient: "founder@example.com" })).toMatchObject({ outcome: "sent" });
    expect(await runDailyReport(now, { mode: "scheduled", recipient: "founder@example.com" })).toMatchObject({ outcome: "already_sent" });
    expect((await mktReports.findOne({ _id: day }))?.emailedAt).toBeInstanceOf(Date);
    expect(await mktReports.countDocuments({ _id: day })).toBe(1);
  });
});

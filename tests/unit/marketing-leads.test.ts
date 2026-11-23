import { beforeEach, describe, expect, it, vi } from "vitest";

// D-120: outreach lead rules (handles, followers, tools, statuses, column guessing) and the admin
// guard on every lead action.

const guard = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const leads = vi.hoisted(() => ({ importLeads: vi.fn(), setLeadStage: vi.fn(), setLeadNotes: vi.fn(), markLeadContacted: vi.fn(), deleteLead: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => guard);
vi.mock("@/lib/marketing/leads", () => leads);
vi.mock("@/lib/audit/log", () => ({ recordAudit: vi.fn(async () => undefined) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (...parts: string[]) => parts.join(":"), takeRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/request-ip", () => ({ getClientIpHash: vi.fn(async () => "iphash") }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { deleteLeadAction, importLeadsAction, updateLeadAction } from "@/lib/marketing/lead-actions";
import {
  cleanLeadNotes,
  cleanLeadRow,
  followersOf,
  formatFollowers,
  guessLeadColumns,
  leadHandleOf,
  leadLink,
  leadProfileUrl,
  platformOf,
  stageGuess,
  toolOf,
} from "@/lib/marketing/leads-rules";
import { leadCodeOf } from "@/lib/marketing/acquisition";

const LEAD = "33333333-3333-4333-8333-333333333333";

describe("lead rules", () => {
  it("reads handles from @names, profile links and plain text", () => {
    expect(leadHandleOf("instagram", "@Maya.Makes")).toBe("maya.makes");
    expect(leadHandleOf("instagram", "https://www.instagram.com/maya_makes/")).toBe("maya_makes");
    expect(leadHandleOf("instagram", "instagram.com/maya_makes?igsh=abc")).toBe("maya_makes");
    expect(leadHandleOf("tiktok", "https://www.tiktok.com/@study.with.ria")).toBe("study.with.ria");
    expect(leadHandleOf("instagram", "  ")).toBeNull();
    expect(leadHandleOf("instagram", "two words")).toBeNull();
    expect(leadHandleOf("instagram", "<script>")).toBeNull();
  });

  it("knows the platform, Instagram when empty", () => {
    expect(platformOf("Instagram")).toBe("instagram");
    expect(platformOf("IG")).toBe("instagram");
    expect(platformOf("")).toBe("instagram");
    expect(platformOf("YouTube")).toBe("youtube");
    expect(platformOf("Twitter")).toBe("x");
    expect(platformOf("Snapchat")).toBe("other");
    expect(leadProfileUrl("instagram", "maya")).toBe("https://www.instagram.com/maya");
    expect(leadProfileUrl("other", "maya")).toBeNull();
  });

  it("reads follower counts in common formats", () => {
    expect(followersOf("12,500")).toBe(12_500);
    expect(followersOf("12.5K")).toBe(12_500);
    expect(followersOf("1.2M")).toBe(1_200_000);
    expect(followersOf("3k+")).toBe(3_000);
    expect(followersOf("about 5k")).toBeNull();
    expect(followersOf("")).toBeNull();
    expect(formatFollowers(12_500)).toBe("13K");
    expect(formatFollowers(1_500)).toBe("1.5K");
    expect(formatFollowers(null)).toBe("-");
  });

  it("names known tools and keeps the rest as other", () => {
    expect(toolOf("Stan Store")).toBe("stan");
    expect(toolOf("stan.store")).toBe("stan");
    expect(toolOf("Linktree")).toBe("linktree");
    expect(toolOf("Beacons.ai")).toBe("beacons");
    expect(toolOf("Selar")).toBe("other");
    expect(toolOf("")).toBe("none");
  });

  it("guesses stages from status words", () => {
    expect(stageGuess("")).toBe("new");
    expect(stageGuess("To contact")).toBe("new");
    expect(stageGuess("Not contacted")).toBe("new");
    expect(stageGuess("Contacted")).toBe("contacted");
    expect(stageGuess("DM sent")).toBe("contacted");
    expect(stageGuess("Replied")).toBe("replied");
    expect(stageGuess("Interested")).toBe("interested");
    expect(stageGuess("Not interested")).toBe("not_interested");
    expect(stageGuess("Do not contact")).toBe("do_not_contact");
    expect(stageGuess("Call booked")).toBe("call_booked");
    expect(stageGuess("Lead")).toBe("new");
  });

  it("guesses the founder's sheet columns", () => {
    const header = ["Name", "Handle", "Platform", "Followers", "Country", "Course topic", "Current tool", "Contact Method", "Status", "Notes"];
    expect(guessLeadColumns(header)).toEqual({ name: 0, handle: 1, platform: 2, followers: 3, country: 4, topic: 5, tool: 6, contactMethod: 7, status: 8, notes: 9 });
    expect(guessLeadColumns(["Username", "Email"]).handle).toBe(0);
    expect(guessLeadColumns(["Email"]).handle).toBe(-1);
  });

  it("cleans a row, and drops one without a handle", () => {
    const row = cleanLeadRow(
      { name: " Maya <b>Patel</b> ", handle: "@maya.makes", platform: "Instagram", followers: "12.5K", country: "USA", topic: "Notion templates", tool: "Stan Store", contactMethod: "DM", status: "Contacted", notes: "Line one\n\n\n\nLine two" },
      (status) => (status === "Contacted" ? "contacted" : "new"),
    );
    expect(row).toEqual({
      platform: "instagram",
      handle: "maya.makes",
      name: "Maya Patel",
      followers: 12_500,
      country: "USA",
      topic: "Notion templates",
      tool: "stan",
      toolLabel: "Stan Store",
      contactMethod: "DM",
      stage: "contacted",
      notes: "Line one\n\nLine two",
    });
    expect(cleanLeadRow({ name: "No handle" }, () => "new")).toBeNull();
    expect(cleanLeadNotes("x".repeat(3_000))).toHaveLength(2_000);
  });

  it("builds a link whose code the signup accepts (D-119)", () => {
    const link = new URL(leadLink("https://pickstall.store/", "k7f3qa2m", "instagram"));
    expect(link.origin + link.pathname).toBe("https://pickstall.store/");
    expect(link.searchParams.get("ref")).toBe("k7f3qa2m");
    expect(link.searchParams.get("utm_source")).toBe("outreach");
    expect(link.searchParams.get("utm_medium")).toBe("instagram_dm");
    expect(leadCodeOf(link.searchParams.get("ref"))).toBe("k7f3qa2m");
  });
});

describe("lead actions need an admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
  });

  it("refuses every action without an admin session", async () => {
    await expect(importLeadsAction({ fileName: "a.csv", firstRow: 2, statusMap: {}, rows: [{ handle: "maya" }] })).rejects.toThrow("NEXT_REDIRECT");
    await expect(updateLeadAction({ action: "stage", leadId: LEAD, stage: "contacted" })).rejects.toThrow("NEXT_REDIRECT");
    await expect(deleteLeadAction({ leadId: LEAD })).rejects.toThrow("NEXT_REDIRECT");
    expect(leads.importLeads).not.toHaveBeenCalled();
    expect(leads.setLeadStage).not.toHaveBeenCalled();
    expect(leads.deleteLead).not.toHaveBeenCalled();
  });

  it("checks the input before changing anything", async () => {
    guard.requireAdmin.mockResolvedValue({ id: "admin", username: "founder" });
    expect(await updateLeadAction({ action: "stage", leadId: LEAD, stage: "signed_up" })).toMatchObject({ ok: false });
    expect(await updateLeadAction({ action: "stage", leadId: "not-a-uuid", stage: "new" })).toMatchObject({ ok: false });
    expect(await importLeadsAction({ fileName: "a.csv", firstRow: 2, statusMap: {}, rows: [] })).toMatchObject({ ok: false });
    expect(leads.setLeadStage).not.toHaveBeenCalled();
    expect(leads.importLeads).not.toHaveBeenCalled();
  });

  it("passes the admin as the actor", async () => {
    guard.requireAdmin.mockResolvedValue({ id: "admin", username: "founder" });
    leads.setLeadStage.mockResolvedValue(true);
    expect(await updateLeadAction({ action: "stage", leadId: LEAD, stage: "replied" })).toEqual({ ok: true, data: { message: "Stage saved." } });
    expect(leads.setLeadStage).toHaveBeenCalledWith(LEAD, "replied", "admin:founder");
  });
});

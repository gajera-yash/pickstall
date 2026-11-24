import type { LeadTool } from "@/lib/marketing/leads-rules";

// Outreach DM drafts (D-121): what a writer gets and returns. A writer never sees the lead's
// handle, notes or exact follower count, only what the message needs.

export type DraftInput = {
  firstName: string | null;
  topic: string | null;
  tool: LeadTool;
  toolLabel: string | null;
  followerBand: string | null;
  country: string | null;
  /** The founder's own DMs, so drafts sound like them. Up to 4, each cut to 600 characters. */
  voiceExamples: string[];
};

export type DraftPair = { firstMessage: string; followUp: string };

export type WriterName = "template" | "groq";

export type DraftResult = DraftPair & { writer: WriterName; model: string | null };

/** Something that writes a first DM and one follow-up. Errors mean "use the template instead". */
export type DraftWriter = { name: WriterName; model: string | null; write: (input: DraftInput) => Promise<DraftPair> };

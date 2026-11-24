import { COMPETITOR_FACTS, PICKSTALL_FACTS } from "@/lib/marketing/ai/facts";
import type { DraftInput, DraftPair, DraftWriter } from "@/lib/marketing/ai/types";

// The free writer (D-121): fixed messages per store tool, filled with the lead's first name and
// topic. Used when no AI is set up, and whenever an AI draft fails or breaks a rule.

function opener(input: DraftInput): string {
  const name = input.firstName ?? "there";
  return input.topic ? `Hey ${name}! I came across your ${input.topic} content and really liked it.` : `Hey ${name}! I came across your content and really liked it.`;
}

const OFFER = `I'm looking for 10 founding creators: ${PICKSTALL_FACTS.foundingOffer}.`;

function firstMessage(input: DraftInput): string {
  const hello = opener(input);
  switch (input.tool) {
    case "stan":
      return `${hello} Quick question: are you still selling through Stan Store? I'm building Pickstall, a link-in-bio store for creators. The tools on Stan's ${COMPETITOR_FACTS.stanCreatorPro} plan, like email broadcasts and upsells, are in our ${PICKSTALL_FACTS.pro} plan, and you can change your checkout, buttons and theme. ${OFFER} Want a quick look?`;
    case "gumroad":
      return `${hello} Are you still selling on Gumroad? I'm building Pickstall, a link-in-bio store with 0% transaction fees: you pay only PayPal's normal processing fee, not ${COMPETITOR_FACTS.gumroadFee}. ${OFFER} Want a quick look?`;
    case "linktree":
    case "beacons":
    case "koji":
      return `${hello} I saw you send people to your link in bio. I'm building Pickstall, a store that lives at one link, so followers can buy your guides or courses in a few taps. ${OFFER} Want a quick look?`;
    case "none":
      return `${hello} Have you thought about selling a guide or course to your followers? I'm building Pickstall, a simple store that lives at one link in your bio. ${OFFER} Want a quick look?`;
    default:
      return `${hello} I'm building Pickstall, a link-in-bio store for creators who sell guides, templates and courses, with plans from ${PICKSTALL_FACTS.starter} a month. ${OFFER} Want a quick look?`;
  }
}

function followUp(input: DraftInput): string {
  const name = input.firstName ?? "there";
  return `No worries if now isn't the right time, ${name}. If you ever want to try it, the founding spot is yours: ${PICKSTALL_FACTS.foundingOffer}. Happy to show you an example store first.`;
}

export function templateDraft(input: DraftInput): DraftPair {
  return { firstMessage: firstMessage(input), followUp: followUp(input) };
}

export const templateWriter: DraftWriter = { name: "template", model: null, write: async (input) => templateDraft(input) };

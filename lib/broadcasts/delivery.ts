import "server-only";

import { renderListEmail, senderName, unsubscribeHeaders } from "@/lib/broadcasts/rules";
import { collections, type SubscriberDoc } from "@/lib/db/collections";
import { publicEnv } from "@/lib/env";
import type { ListEmail } from "@/lib/email/send";
import { newUnsubscribeToken } from "@/lib/subscribers/token";

// Building and sending list emails (D-095). System code: called by the broadcast job and the
// welcome email, never with input from a request.

const origin = () => publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

/** The page a person opens from the footer link (it asks before unsubscribing). */
export const unsubscribePageUrl = (token: string) => `${origin()}/u/${token}`;
/** The RFC 8058 one-click address in the List-Unsubscribe header (a POST unsubscribes at once). */
export const unsubscribeOneClickUrl = (token: string) => `${origin()}/api/unsubscribe/${token}`;

/** Gives subscribers from before D-095 their unsubscribe token; returns each id's token. */
export async function ensureUnsubscribeTokens(storeId: string, people: Pick<SubscriberDoc, "_id" | "unsubscribeToken">[]): Promise<Map<string, string>> {
  const { subscribers } = await collections();
  const tokens = new Map<string, string>();
  for (const person of people) {
    if (person.unsubscribeToken) {
      tokens.set(person._id, person.unsubscribeToken);
      continue;
    }
    const token = newUnsubscribeToken();
    const set = await subscribers.updateOne({ _id: person._id, storeId, unsubscribeToken: { $exists: false } }, { $set: { unsubscribeToken: token } });
    if (set.modifiedCount === 1) tokens.set(person._id, token);
    else {
      // Another run gave one first.
      const again = await subscribers.findOne({ _id: person._id, storeId }, { projection: { unsubscribeToken: 1 } });
      if (again?.unsubscribeToken) tokens.set(person._id, again.unsubscribeToken);
    }
  }
  return tokens;
}

/** One rendered email per subscriber, each with their own unsubscribe link and tags. */
export function listEmailsFor(input: {
  storeId: string;
  storeName: string;
  subject: string;
  body: string;
  replyTo: string | null;
  kind: "broadcast" | "welcome";
  people: Pick<SubscriberDoc, "_id" | "email" | "name">[];
  tokens: Map<string, string>;
}): ListEmail[] {
  const emails: ListEmail[] = [];
  for (const person of input.people) {
    const token = input.tokens.get(person._id);
    if (!token) continue; // never send without a working unsubscribe link
    const rendered = renderListEmail({ storeName: input.storeName, subject: input.subject, body: input.body, name: person.name, unsubscribeUrl: unsubscribePageUrl(token) });
    emails.push({
      to: person.email,
      ...rendered,
      fromName: senderName(input.storeName),
      replyTo: input.replyTo,
      headers: unsubscribeHeaders(unsubscribeOneClickUrl(token)),
      // Resend sends these back with bounce and complaint webhooks (letters, digits, _ and - only).
      tags: [
        { name: "kind", value: input.kind },
        { name: "store_id", value: input.storeId },
        { name: "subscriber_id", value: person._id },
      ],
    });
  }
  return emails;
}


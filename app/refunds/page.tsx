import type { Metadata } from "next";

import { LegalLink, LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME, TRIAL_DAYS } from "@/lib/config";

export const metadata: Metadata = { title: `Refunds and cancellation | ${APP_NAME}`, description: `How cancelling a plan and refunds work on ${APP_NAME}.` };

// Refund and Cancellation Policy (D-074): plan fees (ours) and purchases from creators (theirs).
const sections: LegalSection[] = [
  {
    id: "plans",
    title: "Your Pickstall plan",
    body: (
      <ul>
        <li>The {TRIAL_DAYS}-day free trial costs nothing, and no card is needed to start it.</li>
        <li>You can cancel a paid plan at any time in Settings &gt; Plan &gt; Manage billing. It stays active until the end of the month you already paid for, then your store pauses. You are not charged again.</li>
        <li>Plan fees are not refunded for part of a month or for unused time, except where the law gives you a right to a refund.</li>
        <li>If you were charged by mistake (for example twice, or after cancelling), write to us within 30 days and we will refund the wrong charge.</li>
        <li>Switching between Starter and Pro is pro-rated: the difference is added to, or taken off, your next invoice.</li>
      </ul>
    ),
  },
  {
    id: "purchases",
    title: "Purchases from a creator's store",
    body: (
      <>
        <p>
          When you buy a product in a store, you buy it from that creator, and the creator decides whether and how to refund it. {APP_NAME} does not
          receive your payment, so we cannot refund it ourselves.
        </p>
        <ul>
          <li>Contact the creator first, using the email in your order confirmation.</li>
          <li>Creators refund through their own Stripe account. When a full refund is made, your access to the product ends.</li>
          <li>If a creator does not answer or a product is not what was described, write to us. We will contact the creator and may act under our <LegalLink href="/terms">Terms</LegalLink>.</li>
          <li>Your bank may also let you dispute a card payment. Please try the creator first; disputes take longer.</li>
        </ul>
      </>
    ),
  },
  {
    id: "creators",
    title: "For creators",
    body: (
      <p>
        Tell your buyers your refund rules on your product page. Refunds come out of your own Stripe balance. Our 0% transaction fee means there is no
        platform fee to return, but Stripe may keep its card processing fee on a refunded payment.
      </p>
    ),
  },
];

export default function RefundsPage() {
  return <LegalPage title="Refunds and cancellation" intro={<p>Cancelling your plan is easy, and buyers know who to talk to about a purchase.</p>} sections={sections} />;
}

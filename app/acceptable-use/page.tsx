import type { Metadata } from "next";

import { LegalLink, LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Acceptable Use Policy | ${APP_NAME}`, description: `What can and cannot be sold on ${APP_NAME}.` };

// Acceptable Use Policy (D-074). Also bounded by Stripe's own restricted business list, which applies
// to every creator's Stripe account.
const sections: LegalSection[] = [
  {
    id: "not-allowed",
    title: "Not allowed in any store",
    body: (
      <ul>
        <li>Anything illegal where you or your buyers are, or anything that helps others break the law.</li>
        <li>Content you do not have the rights to: pirated courses, e-books, software, music, templates or someone else&apos;s work.</li>
        <li>Sexual content involving minors (reported to the authorities), and sexually explicit content or services.</li>
        <li>Hate, harassment or violence against people or groups; terrorist or extremist material.</li>
        <li>Weapons, drugs, tobacco or vaping products, and instructions to make them.</li>
        <li>Gambling, betting tips sold as guaranteed wins, lotteries and similar schemes.</li>
        <li>&quot;Get rich quick&quot;, pyramid or multi-level schemes, guaranteed income or investment returns, and unlicensed financial, trading or crypto advice.</li>
        <li>Medical or health products or claims that promise cures, replace professional care or are not allowed by law.</li>
        <li>Malware, hacking tools, stolen accounts, leaked data, or lists of personal data.</li>
        <li>Fake reviews, fake followers, impersonation of a person or brand, or misleading descriptions.</li>
        <li>Anything Stripe does not allow on its platform (Stripe&apos;s restricted businesses list applies to your account).</li>
      </ul>
    ),
  },
  {
    id: "checkout",
    title: "Buyer data and checkout questions",
    body: (
      <ul>
        <li>Never ask buyers for card numbers, bank details, passwords, ID or passport numbers, health information or other sensitive data.</li>
        <li>Use buyers&apos; details only for their purchase and support, and follow privacy law. You are responsible for that data.</li>
        <li>Do not send marketing emails to buyers who have not agreed to receive them.</li>
      </ul>
    ),
  },
  {
    id: "platform",
    title: "Using the platform fairly",
    body: (
      <ul>
        <li>One store per person or business; no new accounts to get extra free trials.</li>
        <li>No attempts to break, overload, scrape or get around the limits and security of {APP_NAME}.</li>
        <li>No phishing pages, link spam or pages that pretend to be another site.</li>
      </ul>
    ),
  },
  {
    id: "enforcement",
    title: "What happens if a store breaks these rules",
    body: (
      <>
        <p>
          We may remove products, pause or close the store and the account, and, where the law requires, report it. For less serious issues we usually
          ask you to fix them first. Serious or repeated breaches can lead to immediate closure.
        </p>
        <p>
          To report a store, email us with its link and what is wrong. For copyright, please use the <LegalLink href="/copyright">copyright complaint process</LegalLink>.
        </p>
      </>
    ),
  },
];

export default function AcceptableUsePage() {
  return <LegalPage title="Acceptable Use Policy" intro={<p>What creators may sell, and what is never allowed, so buyers can trust every {APP_NAME} store.</p>} sections={sections} />;
}

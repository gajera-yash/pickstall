import type { Metadata } from "next";

import { LegalLink, LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME, FOUNDING_MONTHS, TRIAL_DAYS } from "@/lib/config";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: `Terms of Service | ${APP_NAME}`, description: `The rules for using ${APP_NAME}, for creators and buyers.` };

// Terms of Service (D-074). Plain-language draft for review by a lawyer before real money (PRD 8.2).
const sections: LegalSection[] = [
  {
    id: "service",
    title: "What Pickstall is",
    body: (
      <>
        <p>
          {APP_NAME} gives creators an online store at their own link, where they sell digital products and courses. Buyers pay the creator directly
          through the creator&apos;s own PayPal account. {APP_NAME} is a software service: we are not the seller of anything sold in a store, and we are
          not a merchant of record.
        </p>
        <p>These terms are an agreement between you and {LEGAL.operatorName} (&quot;we&quot;, &quot;us&quot;). By creating an account, opening a store or buying from a store, you accept them.</p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use it",
    body: (
      <ul>
        <li>You must be at least 18 years old (or the age of majority where you live) to open a store.</li>
        <li>Buyers under that age may only buy with the involvement of a parent or guardian.</li>
        <li>You must give true information and keep your sign-in email secure. You are responsible for what happens in your account.</li>
        <li>One person or business may open one store. Accounts created to get repeated free trials may be closed.</li>
      </ul>
    ),
  },
  {
    id: "creators",
    title: "Creators: you are the seller",
    body: (
      <>
        <ul>
          <li>You are the seller of record for your sales. You set your prices, describe your products honestly and deliver what you promise.</li>
          <li>You handle your own taxes (income tax, GST, VAT, sales tax), invoices to your buyers, refunds, disputes and chargebacks.</li>
          <li>Payments go to your own PayPal account under PayPal&apos;s terms. {APP_NAME} never holds or forwards your money and takes 0% of your sales. PayPal&apos;s processing fees apply. You keep your PayPal app keys private; {APP_NAME} stores the Secret encrypted and uses it only to take your buyers&apos; payments and refunds.</li>
          <li>
            You are the controller of your buyers&apos; personal data (for example the answers to your checkout questions). Use it only for your
            sales and support, follow privacy law, and never ask for card numbers, ID numbers or other sensitive data at checkout.
          </li>
          <li>Your products and store must follow our <LegalLink href="/acceptable-use">Acceptable Use Policy</LegalLink>.</li>
        </ul>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans, free trial and billing",
    body: (
      <>
        <ul>
          <li>Every new store starts with a {TRIAL_DAYS}-day free trial. No card is needed for the trial. Founding creators chosen by us get {FOUNDING_MONTHS} months free.</li>
          <li>
            When the free period ends without a paid plan, your store is paused: buyers cannot open it or check out, and you cannot publish. Your
            content, orders and customers are kept, and paying for a plan reopens the store.
          </li>
          <li>Paid plans are billed monthly in advance through PayPal. Prices are shown before you pay. Plans renew until you cancel.</li>
          <li>You can cancel at any time in Settings &gt; Plan &gt; Manage billing; your plan stays active until the end of the month you paid for.</li>
          <li>
            Refunds of plan fees are covered by our <LegalLink href="/refunds">Refund and Cancellation Policy</LegalLink>. We may change prices with
            at least 30 days&apos; notice; the new price applies from your next billing period.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "buyers",
    title: "Buyers",
    body: (
      <ul>
        <li>When you buy in a store, you buy from that creator, not from {APP_NAME}. The creator is responsible for the product, its delivery and refunds.</li>
        <li>Your payment is processed by PayPal. We never see or store your card details.</li>
        <li>Purchased products are for your personal use unless the creator says otherwise. Do not share, resell or publish them.</li>
        <li>For problems with a purchase, contact the creator first. If you cannot reach them, write to us and we will try to help.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          You keep all rights to what you upload (texts, images, files, videos). You give us a worldwide, non-exclusive, royalty-free licence to host,
          store, copy, display and deliver it only as needed to run your store and the service. The licence ends when you delete the content or your
          account, except for copies we must keep by law and content already delivered to buyers.
        </p>
        <p>
          You promise you have the rights to what you upload. If someone believes their copyright is infringed, they can use our{" "}
          <LegalLink href="/copyright">copyright complaint process</LegalLink>.
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    title: "What you may not do",
    body: (
      <ul>
        <li>Break the law, or sell anything listed in the <LegalLink href="/acceptable-use">Acceptable Use Policy</LegalLink>.</li>
        <li>Try to access other users&apos; data, test our security without our written permission, or disrupt the service.</li>
        <li>Copy, scrape or resell the service, or use it to send spam.</li>
        <li>Impersonate another person or brand, or mislead buyers.</li>
      </ul>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    body: (
      <>
        <p>
          We may pause or close a store, remove content or close an account that breaks these terms or the law, puts buyers at risk, or is used to
          abuse free trials. Where we reasonably can, we tell you first and give you a chance to fix it.
        </p>
        <p>You can delete your account at any time in Settings &gt; Account. What happens to your data is explained in our <LegalLink href="/privacy">Privacy Policy</LegalLink>.</p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Services we rely on",
    body: (
      <p>
        Payments run on PayPal, emails on Resend, course videos on Bunny.net (and YouTube or Vimeo if a creator links them), and data is stored with
        our hosting and database providers. Their own terms apply to what they do. We are not responsible for outages or decisions of these services,
        for example PayPal declining to work with a creator.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and limit of liability",
    body: (
      <>
        <p>
          The service is provided &quot;as is&quot;. We work to keep it secure and available but cannot promise it will always be uninterrupted or free of
          errors. During the test period features may change.
        </p>
        <p>
          To the extent the law allows, we are not liable for lost profits, lost sales, lost data or indirect damages, and our total liability for any
          claim is limited to the plan fees you paid us in the 12 months before the claim. Nothing in these terms limits liability that cannot be
          limited by law, such as for fraud.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "Your responsibility to us",
    body: (
      <p>
        If a buyer, a rights holder or an authority makes a claim against us because of your products, your content, your taxes or your breach of
        these terms, you agree to cover our reasonable costs and losses from that claim.
      </p>
    ),
  },
  {
    id: "law",
    title: "Law and disputes",
    body: (
      <p>
        These terms are governed by the laws of India. Courts in {LEGAL.city}, {LEGAL.state} have jurisdiction, without taking away any rights you have
        under the consumer laws of the country where you live. Please contact us first; most problems can be solved quickly.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms. For important changes we tell account holders by email or in the dashboard at least 15 days before they apply. If
        you keep using {APP_NAME} after that, the new terms apply; if you do not agree, you can cancel and delete your account.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={<p>The rules for using {APP_NAME}, written to be read. If anything is unclear, ask us.</p>}
      sections={sections}
    />
  );
}

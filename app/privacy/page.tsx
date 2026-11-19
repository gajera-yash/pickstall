import type { Metadata } from "next";

import { LegalLink, LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/config";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: `Privacy Policy | ${APP_NAME}`, description: `What personal data ${APP_NAME} collects, why, and your rights.` };

// Privacy Policy (D-074): GDPR / UK GDPR, CCPA and India's DPDP Act 2023. Describes what the code does
// today; update it whenever a new kind of data or a new service provider is added.
const sections: LegalSection[] = [
  {
    id: "roles",
    title: "Who is responsible",
    body: (
      <>
        <p>
          {LEGAL.operatorName} runs {APP_NAME} and is responsible (the &quot;controller&quot; or &quot;data fiduciary&quot;) for the data of people who create
          an account with us.
        </p>
        <p>
          When you buy from a creator&apos;s store, that <strong>creator</strong> is responsible for your purchase data (name, email, phone if asked,
          checkout answers). We process it on the creator&apos;s behalf to run their store. For questions about how a creator uses your data, contact
          the creator; we will help if you cannot reach them.
        </p>
      </>
    ),
  },
  {
    id: "data",
    title: "What we collect",
    body: (
      <ul>
        <li><strong>Account:</strong> email address, name, phone number if you give one, sign-in records, and whether and when you accepted our Terms.</li>
        <li><strong>Store:</strong> what you publish (store name, bio, photo, links, products, files, course videos), settings, and your plan and billing status.</li>
        <li><strong>Payments:</strong> handled by Stripe. We store Stripe account, customer and subscription ids and payment results, never card numbers.</li>
        <li><strong>Orders:</strong> for each sale, the buyer&apos;s name, email, optional phone, checkout answers, the product, the amount and the status.</li>
        <li><strong>Technical:</strong> a hashed (not readable) form of your IP address and a random browser id, used only to stop abuse such as repeated sign-ups; a log of security-relevant actions on your account (sign-ins, store and plan changes, data downloads), which you can see in your account settings; error reports with secrets and personal details removed; cookies listed in our <LegalLink href="/cookies">Cookie Policy</LegalLink>.</li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "Why we use it, and on what basis",
    body: (
      <ul>
        <li><strong>To run the service you signed up for</strong> (contract): accounts, stores, checkout, delivery, emails about your orders, billing.</li>
        <li><strong>To keep it secure and fair</strong> (legitimate interests): rate limits, preventing free-trial abuse and fraud, fixing errors.</li>
        <li><strong>To meet legal duties</strong> (legal obligation): tax and accounting records, answering lawful requests.</li>
        <li>We do not sell personal data, do not share it for cross-context advertising, and do not send marketing emails without your consent.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>Only with service providers that help us run {APP_NAME}, under contracts that limit them to that purpose:</p>
        <ul>
          <li>Stripe (payments and plan billing)</li>
          <li>Resend (sending emails such as sign-in codes and order emails)</li>
          <li>Bunny.net (storing and streaming course videos)</li>
          <li>Cloudflare R2 (storing product and lesson files)</li>
          <li>MongoDB Atlas (database) and our hosting provider (running the website)</li>
          <li>Sentry (error reports, with tokens, cookies, form contents and user details removed first)</li>
          <li>Google, only if you choose to sign in with Google</li>
        </ul>
        <p>A creator sees the data of their own buyers. We may also disclose data when the law requires it, or to protect people from harm or fraud.</p>
        <p>
          If a creator adds a Meta Pixel or a Google tag to their store pages and you allow it in the banner there, Meta or Google receive data about
          your visit to that store (pages viewed, checkout started, purchase and its amount). The creator is responsible for that; see our{" "}
          <LegalLink href="/cookies">Cookie Policy</LegalLink>.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "Where it is stored",
    body: (
      <p>
        Our providers may process data outside your country, including in the United States and the European Union. Where the law requires it, these
        transfers are covered by safeguards such as the European Commission&apos;s standard contractual clauses.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Account and store data: while your account exists. When you delete your account, we remove your profile and store details at once.</li>
        <li>Orders and plan invoices: as long as tax and accounting law requires, even after an account is deleted, because both creators and buyers rely on them.</li>
        <li>Security records expire on their own: sign-up attempts after 30 minutes, abuse counters after at most 30 days, email links after 30 days, the account activity log after about 13 months.</li>
        <li>After you delete your account we keep only a one-way scrambled form (a hash) of your email, so a new account with the same email does not get a second free trial. It cannot be turned back into your email.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Depending on where you live, you can:</p>
        <ul>
          <li>get a copy of your data (Settings &gt; Account &gt; Download my data gives you a file at once);</li>
          <li>correct it (most of it in your settings) or ask us to delete it (Settings &gt; Account &gt; Delete account);</li>
          <li>object to or restrict some uses, and take your data to another service;</li>
          <li>in the EU or UK, complain to your data protection authority; in California, know, delete and correct your data, and we will not treat you differently for using these rights;</li>
          <li>in India, under the DPDP Act 2023, access, correct and erase your data, have your grievance resolved, and nominate someone to act for you.</li>
        </ul>
        <p>For anything you cannot do in your settings, email our Grievance Officer (below). We answer within 30 days, usually much sooner.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We use encrypted connections, signed sessions, hashed passwords and tokens, access checks on every request, and limits against abuse. No system
        is perfectly secure; if a breach affects your data, we will tell you and the authorities as the law requires.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>{APP_NAME} is not meant for children. You must be 18 to open a store. We do not knowingly collect data from children without a guardian.</p>,
  },
  {
    id: "changes",
    title: "Changes",
    body: <p>We will update this policy when what we do changes, and tell account holders about important changes by email or in the dashboard.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={<p>We collect only what we need to run your store and keep it safe. Here is exactly what, why, and what you can do about it.</p>}
      sections={sections}
    />
  );
}

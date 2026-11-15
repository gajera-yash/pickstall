import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/config";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: `Copyright complaints | ${APP_NAME}`, description: `How to report content on ${APP_NAME} that infringes your copyright.` };

// Copyright complaint (notice and takedown) process (D-074), in line with India's IT Rules 2021 and
// the usual notice / counter-notice practice for hosts.
const sections: LegalSection[] = [
  {
    id: "report",
    title: "Report content that infringes your copyright",
    body: (
      <>
        <p>
          Email{" "}
          <a href={`mailto:${LEGAL.grievanceOfficer.email}`} className="text-blue underline underline-offset-4">
            {LEGAL.grievanceOfficer.email}
          </a>{" "}
          with the subject &quot;Copyright complaint&quot; and include:
        </p>
        <ul>
          <li>your name, postal address, email and phone number, and whether you are the owner or act for them;</li>
          <li>the work you own (a link or a description);</li>
          <li>the exact link(s) on {APP_NAME} with the infringing content;</li>
          <li>a statement that you believe in good faith the use is not allowed by you, your agent or the law;</li>
          <li>a statement that the information is accurate, and your full name as signature.</li>
        </ul>
      </>
    ),
  },
  {
    id: "what-we-do",
    title: "What we do",
    body: (
      <ul>
        <li>We acknowledge your complaint within 24 hours and act on a complete notice as soon as we can, usually by disabling the content.</li>
        <li>We tell the creator and share your notice with them, so they can respond.</li>
        <li>Incomplete or clearly mistaken notices may be returned to you for more details.</li>
      </ul>
    ),
  },
  {
    id: "counter",
    title: "Counter-notice for creators",
    body: (
      <p>
        If your content was removed and you believe that was a mistake, or that you have the rights, reply to our email with your details, the removed
        content, and why. We may restore it unless the complainant tells us they have started legal action.
      </p>
    ),
  },
  {
    id: "repeat",
    title: "Repeat infringement",
    body: <p>We close the accounts of creators who repeatedly infringe other people&apos;s rights.</p>,
  },
  {
    id: "misuse",
    title: "False complaints",
    body: <p>Knowingly false complaints or counter-notices can have legal consequences. If you are not sure the content infringes your rights, please get advice first.</p>,
  },
];

export default function CopyrightPage() {
  return <LegalPage title="Copyright complaints" intro={<p>We respect creators&apos; rights, including yours. Here is how to report content and how we handle it.</p>} sections={sections} />;
}

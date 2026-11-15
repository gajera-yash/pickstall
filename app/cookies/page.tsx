import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Cookie Policy | ${APP_NAME}`, description: `The cookies ${APP_NAME} uses, and why.` };

// Cookie Policy (D-074). Lists every cookie the code sets today. All are strictly necessary, so no
// consent is asked for; adding analytics or ads means adding a consent choice first.
const COOKIES = [
  { name: "better-auth.session_token", purpose: "Keeps you signed in.", lasts: "7 days, renewed while you use the site" },
  { name: "better-auth.session_data", purpose: "A short signed copy of your session so pages load faster.", lasts: "5 minutes" },
  { name: "signup_intent", purpose: "Remembers your sign-up details while you confirm your email code.", lasts: "30 minutes" },
  { name: "ps_device", purpose: "A random id for this browser, used only to limit how many stores one browser opens (anti-abuse).", lasts: "Up to 400 days" },
] as const;

const sections: LegalSection[] = [
  {
    id: "what",
    title: "Cookies we use",
    body: (
      <>
        <p>
          {APP_NAME} only uses cookies that are strictly necessary for the site to work and stay secure. We do not use advertising or tracking
          cookies, and no third party sets cookies through our pages. On the secure site the names may start with &quot;__Secure-&quot;.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead className="bg-bg-subtle">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Cookie</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Why</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">How long</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.map((cookie) => (
                <tr key={cookie.name} className="border-t border-line">
                  <th scope="row" className="px-4 py-2.5 font-mono text-xs font-normal break-all">{cookie.name}</th>
                  <td className="px-4 py-2.5">{cookie.purpose}</td>
                  <td className="px-4 py-2.5">{cookie.lasts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>We also remember in your browser (local storage, not a cookie) that you have closed the cookie notice, so it does not show again.</p>
      </>
    ),
  },
  {
    id: "embeds",
    title: "Videos from other services",
    body: (
      <p>
        Course lessons can play videos from Bunny.net, YouTube (in its privacy-enhanced mode) or Vimeo. When a lesson video plays, that service may set
        its own cookies under its own policy.
      </p>
    ),
  },
  {
    id: "control",
    title: "Your choices",
    body: (
      <p>
        Because these cookies are necessary, the site cannot work without them; you can still block or delete cookies in your browser settings, but
        you will not be able to stay signed in. If we ever add optional cookies, we will ask you first.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return <LegalPage title="Cookie Policy" intro={<p>Short version: only the cookies needed to sign you in and keep the site safe.</p>} sections={sections} />;
}

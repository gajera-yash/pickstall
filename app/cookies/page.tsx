import type { Metadata } from "next";

import { CookieChoiceButton } from "@/components/legal/cookie-choice-button";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Cookie Policy | ${APP_NAME}`, description: `The cookies ${APP_NAME} uses, and why.` };

// Cookie Policy (D-074). Lists every cookie the code sets today: the necessary ones, and Google
// Analytics on Pickstall's own pages, which is set only after the visitor accepts (D-133).
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
          {APP_NAME} uses cookies that are strictly necessary for the site to work and stay secure, listed below. With your permission we also use
          Google Analytics on our own pages (see &quot;Analytics&quot; below). We do not use advertising cookies of our own. Creators can add ad pixels
          to their own store pages; see &quot;Creators&apos; pixels&quot; below. On the secure site the names may start with &quot;__Secure-&quot;.
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
        <p>We also remember in your browser (local storage, not a cookie) your cookie choice, so the notice does not show again.</p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics",
    body: (
      <>
        <p>
          To learn how visitors find and use {APP_NAME}, we use Google Analytics on our own public pages only: the home, pricing, features, FAQ, about and
          comparison pages, sign-up and sign-in, and these legal pages. It never runs on your dashboard, your library, checkout or creators&apos; stores. It loads only after you choose
          &quot;Accept&quot;, with advertising and ad personalisation turned off.
        </p>
        <p>
          Google Analytics sets the cookies <code className="font-mono text-xs">_ga</code> and <code className="font-mono text-xs">_ga_&lt;id&gt;</code> to
          tell visits apart, for up to 2 years, under Google&apos;s policies. You can change your choice here at any time:
        </p>
        <CookieChoiceButton />
      </>
    ),
  },
  {
    id: "pixels",
    title: "Creators' pixels",
    body: (
      <>
        <p>
          A creator may add a Meta (Facebook) Pixel or a Google tag to their own store pages, to measure their ads. These set cookies from Meta or
          Google under those companies&apos; policies. They load only on that creator&apos;s store pages, and only after you choose &quot;Allow&quot;
          in the banner there. They never load on {APP_NAME}&apos;s own pages, your library or the dashboard.
        </p>
        <p>
          The creator decides to use them and is responsible for the data they collect. Your choice is kept in your browser (local storage) for each
          store; use &quot;Cookie settings&quot; at the bottom of the store page to change it.
        </p>
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
        The necessary cookies are needed for the site to work; you can still block or delete cookies in your browser settings, but you will not be
        able to stay signed in. Optional cookies, like Google Analytics or a creator&apos;s pixels, are only set after you allow them, and you can
        change your mind at any time.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return <LegalPage title="Cookie Policy" intro={<p>Short version: the cookies needed to sign you in and keep the site safe, and Google Analytics on our own pages only if you accept.</p>} sections={sections} />;
}

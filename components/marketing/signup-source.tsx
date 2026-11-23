"use client";

import { useEffect, useState } from "react";

import { LEAD_REF_PARAM, SIGNUP_SOURCE_FIELDS, leadCodeOf } from "@/lib/marketing/acquisition";

// Where a creator signup came from (D-119). The landing and signup pages note the link's lead code
// (`?ref=`, the latest wins) and its first UTM tags or referring site in sessionStorage (this tab
// only, gone when it closes; no cookie, no id), and the signup forms send them as hidden fields.
// The server cleans and checks everything again. Store pages keep their own keys (D-112, D-113).

const KEY = "ps_signup_source";

type SignupSourceData = { ref: string; source: string; medium: string; campaign: string; referrer: string };

const EMPTY: SignupSourceData = { ref: "", source: "", medium: "", campaign: "", referrer: "" };

function fromThisPage(withReferrer: boolean): SignupSourceData {
  const params = new URLSearchParams(window.location.search);
  let referrer = "";
  try {
    const ref = withReferrer && document.referrer ? new URL(document.referrer) : null;
    // Moving between our own pages is not a source.
    if (ref && ref.host !== window.location.host) referrer = ref.hostname;
  } catch {
    referrer = "";
  }
  return {
    ref: leadCodeOf(params.get(LEAD_REF_PARAM)) ?? "",
    source: params.get("utm_source") ?? "",
    medium: params.get("utm_medium") ?? "",
    campaign: params.get("utm_campaign") ?? "",
    referrer,
  };
}

function readStored(): SignupSourceData | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Record<string, unknown>;
    const text = (key: keyof SignupSourceData) => (typeof value[key] === "string" ? (value[key] as string).slice(0, 200) : "");
    return { ref: text("ref"), source: text("source"), medium: text("medium"), campaign: text("campaign"), referrer: text("referrer") };
  } catch {
    return null;
  }
}

/** This page's source merged into the stored one: the first visit source stays, a new lead code wins. */
function merged(withReferrer: boolean): SignupSourceData {
  const stored = readStored();
  const here = fromThisPage(withReferrer);
  const visit = stored && (stored.source || stored.referrer) ? stored : here;
  return { ...EMPTY, ...visit, ref: here.ref || stored?.ref || "" };
}

/** Notes the signup source of this tab. Renders nothing. */
export function SignupSource() {
  useEffect(() => {
    try {
      const data = merged(true);
      if (data.ref || data.source || data.referrer) window.sessionStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage blocked (private mode): the signup simply counts as direct.
    }
  }, []);
  return null;
}

/**
 * Hidden signup form fields with this tab's source (the one noted earlier, else this page's).
 * `pageReferrer` is false on pages reached back from Google sign-in, whose referrer is Google.
 */
export function SignupSourceFields({ pageReferrer = true }: { pageReferrer?: boolean }) {
  const [data, setData] = useState<SignupSourceData | null>(null);
  // Read after mount: sessionStorage and the referrer exist only in the browser.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser-only state on mount
  useEffect(() => setData(merged(pageReferrer)), [pageReferrer]);
  if (!data) return null;
  return (
    <>
      {data.ref && <input type="hidden" name={SIGNUP_SOURCE_FIELDS.ref} value={data.ref} />}
      {data.source && <input type="hidden" name={SIGNUP_SOURCE_FIELDS.source} value={data.source} />}
      {data.medium && <input type="hidden" name={SIGNUP_SOURCE_FIELDS.medium} value={data.medium} />}
      {data.campaign && <input type="hidden" name={SIGNUP_SOURCE_FIELDS.campaign} value={data.campaign} />}
      {data.referrer && <input type="hidden" name={SIGNUP_SOURCE_FIELDS.referrer} value={data.referrer} />}
    </>
  );
}

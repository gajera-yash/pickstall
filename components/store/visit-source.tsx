"use client";

import { useEffect, useState } from "react";

import { AFFILIATE_FIELD, AFFILIATE_PARAM, affiliateCodeOf } from "@/lib/affiliates/rules";
import { ATTRIBUTION_FIELDS } from "@/lib/analytics/attribution";

// Where a store visit came from (D-112). The first store page of a browser tab notes the link's UTM
// tags and the referring site's host in sessionStorage (this tab only, gone when it closes; no
// cookie, no id), so the checkout a few pages later can send them with the order. An affiliate's
// `?ref=` code (D-113) is noted the same way; the latest one in the tab wins. The server cleans and
// checks everything again.

const KEY = "ps_visit_source";
const REF_KEY = "ps_ref";

function refFromThisPage(): string | null {
  return affiliateCodeOf(new URLSearchParams(window.location.search).get(AFFILIATE_PARAM));
}

function readRef(): string | null {
  try {
    return affiliateCodeOf(window.sessionStorage.getItem(REF_KEY));
  } catch {
    return null;
  }
}

type VisitSourceData = { source: string; medium: string; campaign: string; referrer: string };

function fromThisPage(): VisitSourceData | null {
  const params = new URLSearchParams(window.location.search);
  let referrer = "";
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    // Moving between our own pages is not a source.
    if (ref && ref.host !== window.location.host) referrer = ref.hostname;
  } catch {
    referrer = "";
  }
  const data = { source: params.get("utm_source") ?? "", medium: params.get("utm_medium") ?? "", campaign: params.get("utm_campaign") ?? "", referrer };
  return data.source || data.referrer ? data : null;
}

function readStored(): VisitSourceData | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Record<string, unknown>;
    const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string).slice(0, 200) : "");
    return { source: text("source"), medium: text("medium"), campaign: text("campaign"), referrer: text("referrer") };
  } catch {
    return null;
  }
}

/** Notes the visit's source once per tab. Renders nothing. */
export function VisitSource() {
  useEffect(() => {
    try {
      const ref = refFromThisPage();
      if (ref) window.sessionStorage.setItem(REF_KEY, ref);
      const here = fromThisPage();
      if (here && !readStored()) window.sessionStorage.setItem(KEY, JSON.stringify(here));
    } catch {
      // Storage blocked (private mode): the order is simply counted as direct, with no affiliate.
    }
  }, []);
  return null;
}

/** Hidden checkout fields with the visit's source (this page's, else the one noted earlier in the tab). */
export function VisitSourceFields() {
  const [data, setData] = useState<{ source: VisitSourceData | null; ref: string | null } | null>(null);
  // Read after mount: sessionStorage and the referrer exist only in the browser.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser-only state on mount
  useEffect(() => setData({ source: readStored() ?? fromThisPage(), ref: refFromThisPage() ?? readRef() }), []);
  if (!data) return null;
  return (
    <>
      {data.ref && <input type="hidden" name={AFFILIATE_FIELD} value={data.ref} />}
      {data.source && <SourceInputs data={data.source} />}
    </>
  );
}

function SourceInputs({ data }: { data: VisitSourceData }) {
  return (
    <>
      <input type="hidden" name={ATTRIBUTION_FIELDS.source} value={data.source} />
      <input type="hidden" name={ATTRIBUTION_FIELDS.medium} value={data.medium} />
      <input type="hidden" name={ATTRIBUTION_FIELDS.campaign} value={data.campaign} />
      <input type="hidden" name={ATTRIBUTION_FIELDS.referrer} value={data.referrer} />
    </>
  );
}

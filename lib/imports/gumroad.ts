import "server-only";

import { fromGumroad, gumroadProducts, type ImportCandidate } from "@/lib/imports/rules";

// Gumroad API (gumroad.com/api, checked 2026-11-21): the creator generates an access token on their
// Gumroad application page and pastes it here. GET https://api.gumroad.com/v2/products lists their
// products. The token is used for this one call and never stored or logged.

export class GumroadError extends Error {
  constructor(readonly kind: "bad_token" | "unavailable" | "bad_response") {
    super(`Gumroad request failed: ${kind}`);
    this.name = "GumroadError";
  }
}

/** The creator's Gumroad products as import candidates for a store selling in `storeCurrency`. */
export async function fetchGumroadCandidates(accessToken: string, storeCurrency: string): Promise<ImportCandidate[]> {
  const url = new URL("https://api.gumroad.com/v2/products");
  url.searchParams.set("access_token", accessToken);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000), redirect: "error" });
  } catch {
    throw new GumroadError("unavailable");
  }
  if (response.status === 401 || response.status === 403) throw new GumroadError("bad_token");
  if (!response.ok) throw new GumroadError("unavailable");
  const parsed = gumroadProducts.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new GumroadError("bad_response");
  return parsed.data.products.map((product) => fromGumroad(product, storeCurrency)).filter((item): item is ImportCandidate => item !== null);
}

import "server-only";

import { z } from "zod";

import { serverEnv } from "@/lib/env.server";
import { usesTestSender } from "@/lib/email/send";

// Email setup check for Admin > Health (D-037 emails not arriving): is the Resend key set and valid,
// and is the EMAIL_FROM domain verified in Resend? Read-only: it lists domains (Resend REST
// GET /domains) and sends nothing. Never returns or logs the key.

export type EmailSetup = {
  keySet: boolean;
  /** "valid", "invalid" (Resend refused the key), "send_only" (a restricted key that cannot list domains) or "unknown" (network). */
  key: "valid" | "invalid" | "send_only" | "unknown" | "missing";
  from: string | null;
  fromDomain: string | null;
  /** Resend's status for the sending domain ("verified", "pending", "failed", ...), or "not_found". */
  domainStatus: string | null;
  testSender: boolean;
};

const domains = z.object({ data: z.array(z.object({ name: z.string(), status: z.string() }).loose()) }).loose();
const failure = z.object({ name: z.string().optional(), message: z.string().optional() }).loose();

function domainOf(from: string | undefined): string | null {
  if (!from) return null;
  const address = /<([^<>\s]+@[^<>\s]+)>/.exec(from)?.[1] ?? from.trim();
  return address.split("@")[1]?.toLowerCase() ?? null;
}

export async function checkEmailSetup(): Promise<EmailSetup> {
  const key = serverEnv.RESEND_API_KEY;
  const from = serverEnv.EMAIL_FROM ?? null;
  const base = { keySet: Boolean(key), from, fromDomain: domainOf(from ?? undefined), testSender: usesTestSender(from ?? undefined) };
  if (!key) return { ...base, key: "missing", domainStatus: null };

  try {
    const response = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = failure.safeParse(json);
      const name = error.success ? error.data.name : undefined;
      if (name === "restricted_api_key") return { ...base, key: "send_only", domainStatus: null };
      // Resend answers 400 validation_error "API key is invalid" (or 401/403) for a wrong key.
      return { ...base, key: response.status === 401 || response.status === 403 || name === "validation_error" ? "invalid" : "unknown", domainStatus: null };
    }
    const list = domains.safeParse(json);
    const match = list.success && base.fromDomain ? list.data.data.find((item) => item.name.toLowerCase() === base.fromDomain) : undefined;
    return { ...base, key: "valid", domainStatus: match ? match.status : "not_found" };
  } catch {
    return { ...base, key: "unknown", domainStatus: null };
  }
}

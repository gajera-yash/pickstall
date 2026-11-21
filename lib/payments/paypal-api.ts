import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

// Minimal PayPal REST client (D-118): OAuth client-credentials token, then JSON calls with a
// Bearer token. No SDK (no new dependency); every response is checked with Zod before use. Shapes
// were checked against PayPal's REST reference and its published OpenAPI files
// (github.com/paypal/paypal-rest-api-specifications) on 2026-11-21. Only lib/payments uses this.

export type PayPalMode = "sandbox" | "live";

/** One PayPal REST app: a creator's own app, or our platform app for billing. */
export type PayPalCredentials = { mode: PayPalMode; clientId: string; secret: string };

const BASE_URL: Record<PayPalMode, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

const TIMEOUT_MS = 15_000;
/** Renew a token this long before PayPal says it expires. */
const TOKEN_MARGIN_MS = 5 * 60_000;

/** A failed PayPal call. `name` and `debugId` come from PayPal's error body and are safe to log. */
export class PayPalApiError extends Error {
  constructor(
    readonly status: number,
    readonly issue: string | undefined,
    readonly debugId: string | undefined,
  ) {
    super(`PayPal request failed (${status}${issue ? ` ${issue}` : ""}).`);
    this.name = "PayPalApiError";
  }
}

const tokenResponse = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });
const errorBody = z.object({ name: z.string().optional(), debug_id: z.string().optional(), error: z.string().optional() }).loose();

// Tokens per app, kept in memory for this server instance. The key includes a hash of the secret,
// so a creator who replaces their secret never gets the old token.
const tokens = new Map<string, { token: string; expiresAt: number }>();

function cacheKey(credentials: PayPalCredentials): string {
  return `${credentials.mode}:${credentials.clientId}:${createHash("sha256").update(credentials.secret).digest("hex").slice(0, 16)}`;
}

async function failure(response: Response): Promise<PayPalApiError> {
  const body = errorBody.safeParse(await response.json().catch(() => null));
  const issue = body.success ? (body.data.name ?? body.data.error) : undefined;
  return new PayPalApiError(response.status, issue, body.success ? body.data.debug_id : undefined);
}

/** An access token for this app (cached until shortly before it expires). Throws PayPalApiError for wrong credentials. */
export async function accessToken(credentials: PayPalCredentials, now = Date.now()): Promise<string> {
  const key = cacheKey(credentials);
  const cached = tokens.get(key);
  if (cached && cached.expiresAt > now) return cached.token;

  const response = await fetch(`${BASE_URL[credentials.mode]}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw await failure(response);
  const parsed = tokenResponse.parse(await response.json());
  tokens.set(key, { token: parsed.access_token, expiresAt: now + parsed.expires_in * 1000 - TOKEN_MARGIN_MS });
  return parsed.access_token;
}

/** Forgets a cached token (after the creator disconnects, or when PayPal says it is no longer valid). */
export function forgetToken(credentials: PayPalCredentials): void {
  tokens.delete(cacheKey(credentials));
}

type CallOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** PayPal-Request-Id: the same id makes a repeated create, capture or refund return the first result. */
  requestId?: string;
};

/** Calls the PayPal REST API and checks the JSON answer with `schema`. A 204 answer is parsed as `{}`. */
export async function paypalCall<T extends z.ZodType>(credentials: PayPalCredentials, path: string, options: CallOptions, schema: T): Promise<z.infer<T>> {
  const token = await accessToken(credentials);
  const response = await fetch(`${BASE_URL[credentials.mode]}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.requestId ? { "PayPal-Request-Id": options.requestId } : {}),
      // The full resource back (not just id, status and links) for orders, captures and refunds.
      Prefer: "return=representation",
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401) forgetToken(credentials);
  if (!response.ok) throw await failure(response);
  const json: unknown = response.status === 204 ? {} : await response.json();
  return schema.parse(json);
}

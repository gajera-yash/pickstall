"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit/log";
import { requireCreator } from "@/lib/auth/guards";
import { STRIPE_CONNECT_RATE_LIMIT } from "@/lib/config";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkPayPalApp, deletePayPalWebhook, ensurePayPalWebhook } from "@/lib/payments/paypal";
import { PayPalApiError, type PayPalCredentials } from "@/lib/payments/paypal-api";
import { paypalConnectAvailable, paypalMode } from "@/lib/payments/paypal-config";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, fieldErrors, ok, type Result } from "@/lib/result";
import { paypalConnectionOfOwner, removePayPalConnection, savePayPalConnection } from "@/lib/stores/paypal";

// Settings > Payments for PayPal (D-118): the creator pastes their own PayPal REST app's Client ID
// and Secret. We check them with PayPal, register our webhook on that app, and store the secret
// encrypted. Everything is scoped to the session owner's store.

const SETTINGS_PATH = "/dashboard/settings/payments";
const NOT_AVAILABLE = "PayPal can't be connected on this server yet. Please try again later.";
const FAILED = "Couldn't connect PayPal. Check your connection and try again.";

const credentialsInput = z.object({
  clientId: z.string().trim().regex(/^[A-Za-z0-9_-]{20,128}$/, { error: "Paste the Client ID of your PayPal app." }),
  secret: z.string().trim().regex(/^[A-Za-z0-9_-]{20,128}$/, { error: "Paste the Secret of your PayPal app." }),
});

export type PayPalConnectState = Result<{ webhook: boolean }> | null;

async function allowed(ownerId: string): Promise<boolean> {
  const { max, windowMinutes } = STRIPE_CONNECT_RATE_LIMIT;
  return takeRateLimit(rateLimitKey("paypal-connect:owner", ownerId), max, windowMinutes);
}

/** Our webhook URL for this store, or null when the app URL cannot receive webhooks (http in development). */
function webhookUrl(storeId: string): string | null {
  const base = new URL(publicEnv.NEXT_PUBLIC_APP_URL);
  if (base.protocol !== "https:") return null;
  return new URL(`/api/webhooks/paypal/${storeId}`, base).href;
}

export async function connectPayPalAction(_prev: PayPalConnectState, formData: FormData): Promise<PayPalConnectState> {
  const { user, store } = await requireCreator(SETTINGS_PATH);
  if (!paypalConnectAvailable()) return err(NOT_AVAILABLE);

  const parsed = credentialsInput.safeParse({ clientId: formData.get("clientId") ?? "", secret: formData.get("secret") ?? "" });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) if (typeof issue.path[0] === "string") fields[issue.path[0]] ??= issue.message;
    return fieldErrors(fields);
  }
  if (!(await allowed(user.id))) return err("Too many attempts. Wait a few minutes, then try again.");

  const mode = paypalMode();
  const credentials: PayPalCredentials = { mode, clientId: parsed.data.clientId, secret: parsed.data.secret };
  try {
    await checkPayPalApp(credentials);
  } catch (error) {
    if (error instanceof PayPalApiError && (error.status === 401 || error.status === 400)) {
      const where = mode === "sandbox" ? "Sandbox" : "Live";
      return err(`PayPal didn't accept these keys. Copy the Client ID and Secret of a ${where} app from developer.paypal.com.`, "clientId");
    }
    logger.error("paypal.connect_check_failed", { status: error instanceof PayPalApiError ? error.status : undefined });
    return err(FAILED);
  }

  try {
    const url = webhookUrl(store.id);
    const webhookId = url ? await ensurePayPalWebhook(credentials, url) : null;
    // Replacing another app: take our webhook off the old one (best effort).
    const previous = await paypalConnectionOfOwner(user.id);
    if (previous?.webhookId && previous.credentials.clientId !== credentials.clientId) {
      await deletePayPalWebhook(previous.credentials, previous.webhookId).catch(() => undefined);
    }
    if (!(await savePayPalConnection(user.id, store.id, { credentials, webhookId }))) return err(FAILED);
    await recordAudit({ actorId: user.id, storeId: store.id, action: "paypal.connected", meta: { mode } });
    revalidatePath("/dashboard", "layout");
    return ok({ webhook: webhookId !== null });
  } catch (error) {
    logger.error("paypal.connect_failed", { status: error instanceof PayPalApiError ? error.status : undefined, issue: error instanceof PayPalApiError ? error.issue : undefined });
    return err(FAILED);
  }
}

export async function disconnectPayPalAction(): Promise<Result<{ disconnected: true }>> {
  const { user, store } = await requireCreator(SETTINGS_PATH);
  try {
    const removed = await removePayPalConnection(user.id);
    if (removed?.webhookId) await deletePayPalWebhook(removed.credentials, removed.webhookId).catch(() => undefined);
  } catch (error) {
    logger.error("paypal.disconnect_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't disconnect PayPal. Please try again.");
  }
  await recordAudit({ actorId: user.id, storeId: store.id, action: "paypal.disconnected" });
  revalidatePath("/dashboard", "layout");
  return ok({ disconnected: true });
}

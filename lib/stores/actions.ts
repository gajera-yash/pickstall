"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCreator, requireCreatorForAction } from "@/lib/auth/guards";
import { STRIPE_CONNECT_RATE_LIMIT, USERNAME_CHANGE_RATE_LIMIT } from "@/lib/config";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { can, cannotPublishMessage } from "@/lib/plans/access";
import { rateLimitKey, releaseRateLimit, takeRateLimit } from "@/lib/rate-limit";
import { err, fieldErrors, ok, type Result } from "@/lib/result";
import { SLUG_TAKEN_MESSAGE, slugSchema } from "@/lib/slug";
import { testSellerAccountId } from "@/lib/payments/test-account";
import { connectAuthorizeUrl, connectAvailable } from "@/lib/payments/connect";
import { changeStoreSlug, setStorePublished, setStoreStripeConnection, updateStorePageDesign, updateStoreProfile } from "@/lib/stores/queries";
import { CONNECT_RETURN_PATHS, connectRedirectUri, createConnectState, releaseAccount } from "@/lib/stores/stripe-connect";
import { pageDesignInput, storeNameSchema, storeProfileInput } from "@/lib/stores/schemas";
import { isCurrencyLocked } from "@/lib/stores/currency-lock";
import { socialLinksFromForm } from "@/lib/stores/social-handles";

export type StoreSetupState = Result<{ savedAt: number }> | null;
export type PageDesignState = Result<{ savedAt: number }> | null;
export type ChangeUsernameState = Result<{ username: string }> | null;

const STORE_SETUP_PATH = "/dashboard/settings";
const MY_STORE_PATH = "/dashboard";
const PUBLISH_STEP_PATH = "/dashboard/setup?step=publish";

const SAVE_FAILED = "Couldn't save your changes. Check your connection and try again.";
const NO_STORE = "We couldn't find your store. Reload the page and try again.";

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

/**
 * Saves Store setup (PRD F8, D-028): name, photo link, bio, currency, social links, and in the setup
 * wizard also the theme and accent (D-045, same rules as Page design). Everything is validated
 * before anything is written. The store is found from the session's user id, never from a form
 * field, so a creator can only change their own.
 */
export async function saveStoreSetup(_prev: StoreSetupState, formData: FormData): Promise<StoreSetupState> {
  const { user, store } = await requireCreator(STORE_SETUP_PATH);

  const social = socialLinksFromForm(formData);
  if (!social.ok) {
    // Report a missing or bad store name together with the social link problem (QA 2026-11).
    const name = storeNameSchema.safeParse(formData.get("name") ?? "");
    return fieldErrors({ ...(name.success ? {} : { name: name.error.issues[0]?.message ?? "Enter a store name." }), [social.field]: social.error });
  }
  const parsed = storeProfileInput.safeParse({
    name: formData.get("name") ?? "",
    bio: formData.get("bio") ?? "",
    avatarUrl: formData.get("avatarUrl") ?? "",
    currency: formData.get("currency"),
    socialLinks: social.links,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const [first, index] = issue?.path ?? [];
    let field = typeof first === "string" ? first : undefined;
    // A problem with one social link points at that platform's row on screen.
    const kind = typeof index === "number" ? social.links[index]?.kind : undefined;
    if (first === "socialLinks") field = kind ? `social-${kind}` : "socialLinks";
    return err(issue?.message ?? "Check the form and try again.", field);
  }

  // The theme fields are only on the wizard's form; Settings leaves them out.
  let design = null;
  if (formData.has("themePreset")) {
    const parsedDesign = pageDesignInput.safeParse({ themePreset: formData.get("themePreset"), accent: formData.get("accent") ?? "" });
    if (!parsedDesign.success) {
      const issue = parsedDesign.error.issues[0];
      return err(issue?.message ?? "Check the form and try again.", typeof issue?.path[0] === "string" ? issue.path[0] : undefined);
    }
    design = parsedDesign.data;
  }

  try {
    // Prices are stored in the currency's own units, so the currency locks with the first product (D-046).
    if (parsed.data.currency !== store.currency && (await isCurrencyLocked(store.id))) {
      return err("Your prices are set in your current currency, so it can't change once you have a product.", "currency");
    }
    const saved = await updateStoreProfile(user.id, parsed.data);
    if (!saved) return err(NO_STORE);
    if (design && !(await updateStorePageDesign(user.id, design))) return err(NO_STORE);
  } catch (error) {
    logger.error("stores.setup_save_failed", { name: errorName(error) });
    return err(SAVE_FAILED);
  }

  revalidatePath("/dashboard", "layout");
  return ok({ savedAt: Date.now() });
}

/** Saves the Page design tab (theme and accent) on the creator's own store. */
export async function savePageDesign(_prev: PageDesignState, formData: FormData): Promise<PageDesignState> {
  const { user } = await requireCreator(MY_STORE_PATH);

  const parsed = pageDesignInput.safeParse({
    themePreset: formData.get("themePreset"),
    accent: formData.get("accent") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    return err(issue?.message ?? "Check the form and try again.", field);
  }

  try {
    const saved = await updateStorePageDesign(user.id, parsed.data);
    if (!saved) return err(NO_STORE);
  } catch (error) {
    logger.error("stores.page_design_save_failed", { name: errorName(error) });
    return err(SAVE_FAILED);
  }

  revalidatePath("/dashboard", "layout");
  return ok({ savedAt: Date.now() });
}

/**
 * Changes the creator's username (PRD F8). Same rules as signup (lib/slug.ts, reserved names read
 * as taken), limited per owner (D-028). The unique index decides taken names; an attempt that
 * fails because the name is taken does not count against the limit.
 */
export async function changeUsername(_prev: ChangeUsernameState, formData: FormData): Promise<ChangeUsernameState> {
  const { user, store } = await requireCreator(STORE_SETUP_PATH);

  const raw = z.string().max(64).safeParse(formData.get("username"));
  const parsed = slugSchema.safeParse(raw.success ? raw.data.trim().toLowerCase() : "");
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the username.", "username");

  const username = parsed.data;
  if (username === store.slug) return err("This is already your username.", "username");

  const key = rateLimitKey("username-change:owner", user.id);
  try {
    const { max, windowMinutes } = USERNAME_CHANGE_RATE_LIMIT;
    if (!(await takeRateLimit(key, max, windowMinutes))) {
      return err(`You can change your username ${max} times a day. Try again tomorrow.`, "username");
    }

    const result = await changeStoreSlug(user.id, username);
    if (result !== "changed") {
      await releaseRateLimit(key);
      return result === "taken" ? err(SLUG_TAKEN_MESSAGE, "username") : err(NO_STORE);
    }
  } catch (error) {
    logger.error("stores.username_change_failed", { name: errorName(error) });
    await releaseRateLimit(key).catch(() => undefined);
    return err("Couldn't change your username. Check your connection and try again.");
  }

  await recordAudit({ actorId: user.id, action: "store.username_changed", meta: { username } });
  revalidatePath("/dashboard", "layout");
  return ok({ username });
}

const connectReturnInput = z.enum(["settings", "setup"]);

/**
 * Starts Stripe Connect OAuth (D-053): returns the Stripe page to open. The state is bound to this
 * user and used once by the callback. Rate limited.
 */
export async function startStripeConnect(returnTo: "settings" | "setup"): Promise<Result<{ url: string }>> {
  const { user } = await requireCreator(CONNECT_RETURN_PATHS.settings);
  const target = connectReturnInput.safeParse(returnTo);
  if (!target.success) return err(SAVE_FAILED);
  if (!connectAvailable()) return err("Connecting Stripe isn't switched on for this server yet.");
  try {
    const { max, windowMinutes } = STRIPE_CONNECT_RATE_LIMIT;
    if (!(await takeRateLimit(rateLimitKey("stripe-connect", user.id), max, windowMinutes))) return err("Too many attempts. Wait a few minutes, then try again.");
    const state = await createConnectState(user.id, target.data);
    return ok({ url: connectAuthorizeUrl({ state, redirectUri: connectRedirectUri(), email: user.email }) });
  } catch (error) {
    logger.error("stores.stripe_connect_start_failed", { name: errorName(error) });
    return err("Couldn't open Stripe. Check your connection and try again.");
  }
}

/**
 * Test mode only (D-034): uses the founder's own Stripe test account as this store's seller account,
 * so real Stripe Checkout can be tried without a second Stripe account. Refused with a live key.
 */
export async function connectStripeTestAccount(): Promise<Result<{ connected: true }>> {
  const { user } = await requireCreator(CONNECT_RETURN_PATHS.settings);
  const accountId = testSellerAccountId();
  if (!accountId) return err("Test Stripe isn't set up on this server.");
  try {
    const saved = await setStoreStripeConnection(user.id, {
      accountId,
      livemode: false,
      status: { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true },
    });
    // The shortcut is not exclusive, so "in_use" cannot happen here.
    if (!saved || saved === "in_use") return err(NO_STORE);
    if (saved.previousAccountId && saved.previousAccountId !== accountId) await releaseAccount(user.id, saved.previousAccountId);
  } catch (error) {
    logger.error("stores.stripe_connect_failed", { name: errorName(error) });
    return err(SAVE_FAILED);
  }
  await recordAudit({ actorId: user.id, action: "stripe.connected", meta: { testAccount: true } });
  revalidatePath("/dashboard", "layout");
  return ok({ connected: true });
}

/**
 * Disconnects Stripe from the creator's own store, and from our platform on Stripe's side. Paid
 * products are unpublished (PRD 5.6 A); free ones stay.
 */
export async function disconnectStripe(): Promise<Result<{ connected: false }>> {
  const { user } = await requireCreator(CONNECT_RETURN_PATHS.settings);
  try {
    const saved = await setStoreStripeConnection(user.id, null);
    if (!saved || saved === "in_use") return err(NO_STORE);
    if (saved.previousAccountId) await releaseAccount(user.id, saved.previousAccountId);
  } catch (error) {
    logger.error("stores.stripe_disconnect_failed", { name: errorName(error) });
    return err(SAVE_FAILED);
  }
  await recordAudit({ actorId: user.id, action: "stripe.disconnected" });
  revalidatePath("/dashboard", "layout");
  return ok({ connected: false });
}

/** Publishes or unpublishes the creator's own store page (the last step of the first-run checklist). */
export async function setStorePublishedAction(isPublished: boolean, from?: "setup"): Promise<Result<{ isPublished: boolean }>> {
  // A session that ended meanwhile goes to login with "Your session expired", then back here to try again.
  const { user, store } = await requireCreatorForAction(from === "setup" ? PUBLISH_STEP_PATH : MY_STORE_PATH);
  if (typeof isPublished !== "boolean") return err(SAVE_FAILED);
  // Unpublishing always works; publishing needs an open store (D-072).
  if (isPublished && !can(store.access, "publish")) return err(cannotPublishMessage(store.access));

  try {
    if (!(await setStorePublished(user.id, isPublished))) return err(NO_STORE);
  } catch (error) {
    logger.error("stores.publish_failed", { name: errorName(error) });
    return err(SAVE_FAILED);
  }

  await recordAudit({ actorId: user.id, storeId: store.id, action: isPublished ? "store.published" : "store.unpublished" });
  revalidatePath("/dashboard", "layout");
  return ok({ isPublished });
}

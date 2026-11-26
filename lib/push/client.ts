"use client";

import { publicEnv } from "@/lib/env";
import { deletePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/push/actions";

// Browser side of push notifications (D-132): register the push service worker, subscribe with our
// VAPID public key, and send the subscription to the server. Nothing runs until the creator clicks.

export const PUSH_SW_URL = "/push-sw.js";

export function pushSupported(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The VAPID key as the bytes PushManager.subscribe wants. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** This browser's current push subscription, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(PUSH_SW_URL);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission, subscribes and saves. Returns what happened, in words for the creator. */
export async function turnOnPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: permission === "denied" ? "Notifications are blocked for this site. Allow them in your browser settings." : "Notifications were not allowed." };
  try {
    const registration = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: "/" });
    await navigator.serviceWorker.ready;
    const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string) }));
    const json = subscription.toJSON();
    const result = await savePushSubscriptionAction({ endpoint: json.endpoint, keys: json.keys });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch {
    return { ok: false, error: "This browser couldn't turn on notifications. On iPhone, add Pickstall to your Home Screen first." };
  }
}

export async function turnOffPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await deletePushSubscriptionAction(subscription.endpoint);
  await subscription.unsubscribe();
}

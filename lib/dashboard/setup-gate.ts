import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { requireCreator, type AuthUser, type CreatorStore } from "@/lib/auth/guards";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { isDashboardUnlocked, isPathOpenWhileLocked } from "@/lib/dashboard/setup-lock";
import { loadSetupState, type SetupState } from "@/lib/dashboard/setup-state";
import { storeHasOrders } from "@/lib/orders/creator-queries";

export type SetupGate = SetupState & { unlocked: boolean };

type GateStore = Pick<CreatorStore, "id" | "bio" | "avatarUrl" | "chargesEnabled" | "isPublished"> & Partial<Pick<CreatorStore, "profileSaved">>;

// Cached per request on plain values, so the layout's nav, top bar and footer and the page share
// one lookup.
const gateFor = cache(async (id: string, bio: string | null, avatarUrl: string | null, chargesEnabled: boolean, isPublished: boolean, profileSaved: boolean): Promise<SetupGate> => {
  const state = await loadSetupState({ id, bio, avatarUrl, chargesEnabled, isPublished, profileSaved });
  // Orders only matter while setup is incomplete. When the database is unreachable, setup decides.
  const hasOrders = !state.checklist.complete && (await storeHasOrders(id).catch(() => false));
  return { ...state, unlocked: isDashboardUnlocked({ setupComplete: state.checklist.complete, hasOrders }) };
});

/**
 * Setup progress plus whether the dashboard is unlocked (D-079). `store` must come from
 * requireCreator, so every query is scoped to the session owner's store.
 */
export function loadSetupGate(store: GateStore): Promise<SetupGate> {
  return gateFor(store.id, store.bio, store.avatarUrl, store.chargesEnabled, store.isPublished, store.profileSaved ?? false);
}

/**
 * requireCreator for dashboard pages that are locked during setup: while setup is incomplete, a
 * page that is not open while locked redirects to My Store, which shows the onboarding screen.
 */
export async function requireUnlockedCreator(path: string): Promise<{ user: AuthUser; store: CreatorStore }> {
  const context = await requireCreator(path);
  if (isPathOpenWhileLocked(path)) return context;
  const { unlocked } = await loadSetupGate(context.store);
  if (!unlocked) redirect(DASHBOARD_PATH);
  return context;
}

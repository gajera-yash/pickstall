import { permanentRedirect } from "next/navigation";

// Store setup moved to Settings > Store (D-028). Old links and bookmarks still land there.
// A redirect only, nothing to prerender or check for instant navigation.
export const instant = false;

export default function StoreSetupRedirect() {
  permanentRedirect("/dashboard/settings");
}

import { permanentRedirect } from "next/navigation";

// Store setup moved to Settings > Store (D-028). Old links and bookmarks still land there.
export default function StoreSetupRedirect() {
  permanentRedirect("/dashboard/settings");
}

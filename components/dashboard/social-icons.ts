import { AtSign, BriefcaseBusiness, Camera, Globe, Music2, PlaySquare, ThumbsUp, type LucideIcon } from "lucide-react";

import type { SocialLinkKind } from "@/lib/config";

// lucide-react has no brand logos, so each kind gets a plain icon; the kind name is always the
// accessible label next to it.
export const SOCIAL_ICONS: Record<SocialLinkKind, LucideIcon> = {
  website: Globe,
  instagram: Camera,
  youtube: PlaySquare,
  tiktok: Music2,
  x: AtSign,
  linkedin: BriefcaseBusiness,
  facebook: ThumbsUp,
};

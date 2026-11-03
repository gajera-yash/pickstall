import { AtSign, BriefcaseBusiness, Camera, Globe, Mail, Music2, PlaySquare, ThumbsUp, type LucideIcon } from "lucide-react";

import type { SocialLinkKind } from "@/lib/config";

// Plain lucide stand-ins for each kind. The dashboard and store pages show the real logos
// (components/brand/social-logos.tsx, D-046); these remain for small marketing mockups.
export const SOCIAL_ICONS: Record<SocialLinkKind, LucideIcon> = {
  website: Globe,
  instagram: Camera,
  youtube: PlaySquare,
  tiktok: Music2,
  x: AtSign,
  linkedin: BriefcaseBusiness,
  facebook: ThumbsUp,
  email: Mail,
};

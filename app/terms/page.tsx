import type { Metadata } from "next";

import { LegalPlaceholder } from "@/components/legal/legal-placeholder";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Terms | ${APP_NAME}`, robots: { index: false } };

export default function TermsPage() {
  return <LegalPlaceholder title="Terms" />;
}

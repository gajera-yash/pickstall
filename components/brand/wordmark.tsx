import { cn } from "@/lib/utils";
import Link from "next/link";

import { APP_NAME } from "@/lib/config";

/** The product name as a link to the home page. The name comes from lib/config.ts only. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("font-display text-h3 font-extrabold text-ink", className)}>
      {APP_NAME}
    </Link>
  );
}

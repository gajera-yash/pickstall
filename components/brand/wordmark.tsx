import Image from "next/image";
import Link from "next/link";

import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

import logo from "@/public/brand/pickstall-logo.webp";

/**
 * The Pickstall logo (D-026) as a link to the home page. The file has a near-white background,
 * so `mix-blend-multiply` lets it sit on white and on the subtle auth background without a box.
 * Size it with a height class, for example `h-8` in the app and `h-12` on auth pages.
 */
export function Wordmark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label={`${APP_NAME} home`} className={cn("inline-flex shrink-0", className)}>
      <Image src={logo} alt={APP_NAME} priority={priority} sizes="240px" className="h-full w-auto mix-blend-multiply" />
    </Link>
  );
}

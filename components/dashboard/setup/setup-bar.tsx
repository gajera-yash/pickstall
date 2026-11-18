"use client";

import { ArrowRight, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SETUP_PATH } from "@/lib/dashboard/checklist";

/**
 * A slim bar above dashboard pages while setup is not finished (D-045): how far along the creator is
 * and a button back into the wizard, so after making a product (or anything else) the next step is
 * one click away. Hidden on My Store and in the wizard, which show the steps themselves.
 */
export function SetupBar({ doneCount, requiredCount, nextLabel }: { doneCount: number; requiredCount: number; nextLabel: string }) {
  const pathname = usePathname();
  if (pathname === "/dashboard" || pathname === SETUP_PATH || pathname.startsWith(`${SETUP_PATH}/`)) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-blue-soft px-4 py-3 sm:flex-row sm:items-center">
      <p className="flex flex-1 items-center gap-3 text-sm">
        <ListChecks aria-hidden="true" className="size-5 shrink-0 text-blue" />
        <span>
          <span className="font-semibold">
            Setup {doneCount} of {requiredCount} done.
          </span>{" "}
          Next: {nextLabel}
        </span>
      </p>
      <Button asChild size="sm" className="self-start sm:self-auto">
        <Link href={SETUP_PATH}>
          Continue setup
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

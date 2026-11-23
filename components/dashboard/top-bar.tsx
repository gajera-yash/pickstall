"use client";

import { ExternalLink, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { CommandMenu } from "@/components/dashboard/command-menu";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

type Props = {
  displayName: string;
  email: string | null;
  storeUrl: string;
  publicPath: string | null;
  /** Setup is not done (D-079): search and "View my store" are hidden, as there is nothing to find or show yet. */
  locked: boolean;
};

/**
 * Dashboard top bar (D-029, reference docs/ui-reference/dashboard.webp): search / command palette,
 * "View my store", notifications and the account menu. 64px high, sticky, white.
 */
export function TopBar({ displayName, email, storeUrl, publicPath, locked }: Props) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
      <Wordmark className="h-7 md:hidden" />

      <div className="flex min-w-0 flex-1 justify-end md:justify-start">
        {!locked && <CommandMenu storeUrl={storeUrl} />}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {!locked && (
        <Button asChild variant="secondary" size="sm" className="hidden h-10 sm:inline-flex">
          <Link href={publicPath ?? "/dashboard/design"} {...(publicPath ? { target: "_blank", rel: "noopener" } : {})}>
            <ExternalLink aria-hidden="true" className="size-4" />
            View my store
          </Link>
        </Button>
        )}
        <NotificationBell />
        <AccountMenu displayName={displayName} email={email} />
      </div>
    </header>
  );
}


function AccountMenu({ displayName, email }: { displayName: string; email: string | null }) {
  const signOutForm = useRef<HTMLFormElement>(null);
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full data-[state=open]:bg-bg-subtle">
          <Avatar aria-hidden="true">
            <AvatarFallback className="text-base">{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-semibold">{displayName}</span>
          {email && <span className="truncate text-sm font-normal text-mute">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/account">
            <UserRound aria-hidden="true" />
            Account settings
          </Link>
        </DropdownMenuItem>
        {/* The menu would unmount the form before a native submit, so the item submits it itself
            and keeps the menu open until the redirect. */}
        <form ref={signOutForm} action={signOut} />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            signOutForm.current?.requestSubmit();
          }}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

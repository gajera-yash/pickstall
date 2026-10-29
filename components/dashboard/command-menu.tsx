"use client";

import { Copy, Palette, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { SECTION_ICONS } from "@/components/dashboard/dashboard-nav";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DASHBOARD_SECTIONS } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

const noSubscribe = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Search box in the top bar and the ⌘K / Ctrl+K command palette (reference dashboard.webp): jump to
 * any section or run a quick action. Products, orders and customers join the results once they exist.
 */
export function CommandMenu({ storeUrl }: { storeUrl: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const mac = useSyncExternalStore(noSubscribe, isMac, () => true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      {/* Desktop: a search box. Phones: an icon, because the box would not fit next to the logo. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden h-11 w-full max-w-lg min-w-0 cursor-pointer items-center gap-3 rounded-md border border-line bg-bg-subtle px-3 text-left text-sm text-mute md:flex",
          "transition-colors duration-(--dur-fast) hover:border-input hover:bg-surface",
        )}
      >
        <Search aria-hidden="true" className="size-5 shrink-0" />
        <span className="flex-1 truncate">Search products, orders, customers...</span>
        <kbd className="shrink-0 rounded-sm border border-line bg-surface px-1.5 py-0.5 font-sans text-xs font-semibold text-mute">
          {mac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-bg-subtle md:hidden"
      >
        <Search aria-hidden="true" className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl sm:p-0 [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Jump to a page or run a quick action.</DialogDescription>
          <Command loop>
            <CommandInput placeholder="Search pages and actions..." aria-label="Search pages and actions" className="text-base" />
            <CommandList className="max-h-[min(60dvh,26rem)]">
              <CommandEmpty>Nothing found. Products, orders and customers show up here once you have them.</CommandEmpty>
              <CommandGroup heading="Quick actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-mute">
                <CommandItem onSelect={() => run(() => router.push("/dashboard/products/new"))}>
                  <Plus aria-hidden="true" className="size-5 text-blue" />
                  Add a product
                </CommandItem>
                <CommandItem onSelect={() => run(() => void navigator.clipboard?.writeText(storeUrl))}>
                  <Copy aria-hidden="true" className="size-5 text-mute" />
                  Copy my store link
                </CommandItem>
                <CommandItem onSelect={() => run(() => router.push("/dashboard?tab=design"))}>
                  <Palette aria-hidden="true" className="size-5 text-mute" />
                  Customize store design
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Go to" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-mute">
                {DASHBOARD_SECTIONS.map((section) => {
                  const Icon = SECTION_ICONS[section.id];
                  return (
                    <CommandItem key={section.id} value={`go ${section.label}`} onSelect={() => run(() => router.push(section.href))}>
                      <Icon aria-hidden="true" className="size-5 text-mute" />
                      {section.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

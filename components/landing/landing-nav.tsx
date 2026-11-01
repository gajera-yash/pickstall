"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { LANDING_NAV } from "@/components/landing/content";
import { cn } from "@/lib/utils";

/**
 * Sticky landing nav. It gets a border once the page scrolls; below md the links move into a
 * full-width menu. `actions` are the sign-in buttons (or "Go to dashboard"), rendered on the server.
 */
export function LandingNav({ actions }: { actions: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-bg transition-colors duration-(--dur-base)", scrolled || open ? "border-line" : "border-transparent")}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Wordmark priority className="h-9" />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
          {LANDING_NAV.map((item) => (
            <a key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-semibold text-ink hover:bg-bg-subtle">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">{actions}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          aria-expanded={open}
          aria-controls="landing-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>
      {open && (
        <div id="landing-menu" className="border-t border-line bg-bg px-4 pt-2 pb-5 md:hidden">
          <nav aria-label="Main" className="flex flex-col">
            {LANDING_NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-md px-2 py-3 text-base font-semibold text-ink hover:bg-bg-subtle">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 [&>*]:w-full">{actions}</div>
        </div>
      )}
    </header>
  );
}

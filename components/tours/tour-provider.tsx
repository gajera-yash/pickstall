"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { markTourSeenAction, resetToursAction } from "@/lib/tours/actions";
import { TOURS, type TourId, type TourStep } from "@/lib/tours/catalog";

// Guided tours (D-128): coach marks that point at elements marked with `data-tour`. One tour at a
// time; Esc or "Skip" ends it, the arrow keys move between steps, and finishing or skipping marks it
// seen for this user (saved in the database, so it does not come back on another device).

type TourState = {
  /** Null until the seen list has loaded (then tours and hotspots may appear). */
  seen: Set<string> | null;
  /** False while setup is incomplete: no tours or hotspots then (the checklist guides). */
  enabled: boolean;
  start: (id: TourId) => void;
  markSeen: (id: string) => void;
  /** "Take the tour again": forgets every tour and starts the welcome tour. */
  restart: () => Promise<void>;
  /** Called once by the server data loader. */
  seed: (seen: string[], enabled: boolean) => void;
};

const TourContext = createContext<TourState | null>(null);

export function useTours(): TourState | null {
  return useContext(TourContext);
}

const visibleTarget = (target: string): HTMLElement | null => {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return element;
  }
  return null;
};

export function TourProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState<{ id: TourId; steps: TourStep[]; index: number } | null>(null);

  const seed = useCallback((list: string[], on: boolean) => {
    setSeen(new Set(list));
    setEnabled(on);
  }, []);

  const markSeen = useCallback((id: string) => {
    setSeen((current) => new Set([...(current ?? []), id]));
    void markTourSeenAction(id);
  }, []);

  const start = useCallback((id: TourId) => {
    // Only steps whose element is on screen now (phone layouts hide some).
    const steps = TOURS[id].filter((step) => visibleTarget(step.target));
    if (steps.length === 0) return;
    setActive({ id, steps, index: 0 });
  }, []);

  const restart = useCallback(async () => {
    await resetToursAction();
    setSeen((current) => new Set([...(current ?? [])].filter((id) => !(id in TOURS))));
    start("welcome");
  }, [start]);

  const finish = useCallback(() => {
    if (active) markSeen(active.id);
    setActive(null);
  }, [active, markSeen]);

  const value = useMemo(() => ({ seen, enabled, start, markSeen, restart, seed }), [seen, enabled, start, markSeen, restart, seed]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && (
        <CoachMark
          key={`${active.id}-${active.index}`}
          step={active.steps[active.index]!}
          index={active.index}
          total={active.steps.length}
          onBack={() => setActive((current) => (current && current.index > 0 ? { ...current, index: current.index - 1 } : current))}
          onNext={() => (active.index + 1 >= active.steps.length ? finish() : setActive({ ...active, index: active.index + 1 }))}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}

/** Starts a page's tour once, the first time this creator opens the page (after setup is done). */
export function PageTour({ id, delayMs = 700 }: { id: TourId; delayMs?: number }) {
  const tours = useTours();
  const started = useRef(false);
  const ready = tours?.seen !== null && tours?.seen !== undefined && tours.enabled;
  const done = tours?.seen?.has(id) ?? true;
  useEffect(() => {
    if (!ready || done || started.current) return;
    started.current = true;
    const timer = window.setTimeout(() => tours?.start(id), delayMs);
    return () => window.clearTimeout(timer);
  }, [ready, done, id, delayMs, tours]);
  return null;
}

/** Hands the server's seen list to the provider. */
export function TourSeed({ seen, enabled }: { seen: string[]; enabled: boolean }) {
  const seed = useTours()?.seed;
  useEffect(() => {
    seed?.(seen, enabled);
  }, [seed, seen, enabled]);
  return null;
}

type Box = { top: number; left: number; width: number; height: number };
const CARD_WIDTH = 320;
const GAP = 12;
const PAD = 6;

/** One step: a spotlight around the element and a small card next to it (docked at the bottom on phones). */
function CoachMark({ step, index, total, onBack, onNext, onSkip }: { step: TourStep; index: number; total: number; onBack: () => void; onNext: () => void; onSkip: () => void }) {
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [cardHeight, setCardHeight] = useState(180);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const element = visibleTarget(step.target);
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setBox({ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 });
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      if (card.current) setCardHeight(card.current.offsetHeight);
    };
    measure();
    const timer = window.setInterval(measure, 250); // follows smooth scrolling and layout shifts
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.target]);

  useEffect(() => {
    next.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
      else if (event.key === "ArrowRight") onNext();
      else if (event.key === "ArrowLeft") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onNext, onSkip]);

  if (!box) return null;
  const phone = viewport.width < 640;
  const below = box.top + box.height + GAP;
  const top = below + cardHeight < viewport.height ? below : Math.max(GAP, box.top - GAP - cardHeight);
  const left = Math.min(Math.max(GAP, box.left), Math.max(GAP, viewport.width - CARD_WIDTH - GAP));
  const titleId = `tour-title-${index}`;

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* The spotlight: everything but the element is dimmed; clicks on the dim area end nothing. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-lg ring-2 ring-blue transition-all duration-(--dur-base) motion-reduce:transition-none"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px var(--scrim)" }}
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        className="fixed flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-ink shadow-popover"
        style={phone ? { left: 12, right: 12, bottom: 12 } : { top, left, width: CARD_WIDTH }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-h4">
            {step.title}
          </h2>
          <button type="button" onClick={onSkip} aria-label="Close the tour" className="-m-1 rounded-md p-1 text-mute hover:text-ink focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <p className="text-sm text-mute">{step.body}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-mute tabular-nums">
            {index + 1} of {total}
          </span>
          <div className="flex items-center gap-2">
            {index === 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
                Skip
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={onBack}>
                Back
              </Button>
            )}
            <Button ref={next} type="button" size="sm" onClick={onNext}>
              {index + 1 >= total ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

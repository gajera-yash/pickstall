"use client";

import { LazyMotion, MotionConfig, domAnimation, m, useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Motion helpers for the marketing landing (LANDING_PAGE_PROMPT_V2 section 8). Transform and
// opacity only, `reducedMotion="user"` turns transform animations off, and nothing starts hidden on
// the server: content stays readable without JavaScript.

/** Loads the small DOM animation bundle once for the whole landing page. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

const HIDDEN = {
  rise: { opacity: 0, y: 24 },
  print: { y: "-100%" },
  grow: { scaleY: 0.08 },
} as const;
const SHOWN = { opacity: 1, y: 0, scaleY: 1 } as const;

/**
 * Plays one entrance when the element scrolls into view. It renders visible on the server and only
 * hides itself after mount when it is still below the fold, so no-JS visitors and visitors who
 * land mid-page never see an empty block.
 */
export function Reveal({
  children,
  variant = "rise",
  delay = 0,
  className,
}: {
  children: ReactNode;
  variant?: keyof typeof HIDDEN;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (reduce || !node) return;
    // Only arm when the block starts below the viewport; otherwise leave it as rendered.
    const belowFold = node.getBoundingClientRect().top > window.innerHeight;
    if (belowFold) queueMicrotask(() => setArmed(true));
  }, [reduce]);

  const hidden = armed && !inView;
  // The observer watches this static wrapper: the moving child can sit outside a clipping parent
  // (the receipt "print" starts above its slot), where it would never count as in view.
  return (
    <div ref={ref} className={className}>
      <m.div
        initial={false}
        animate={hidden ? HIDDEN[variant] : SHOWN}
        transition={hidden ? { duration: 0 } : { delay, duration: variant === "print" ? 0.7 : 0.55 }}
        className={cn("h-full", variant === "grow" && "origin-bottom")}
      >
        {children}
      </m.div>
    </div>
  );
}

/** A gentle pointer tilt for product mockups. Mouse only; off for touch and reduced motion. */
export function Tilt({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion();
  const rotateX = useSpring(useMotionValue(0), { stiffness: 160, damping: 18 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 160, damping: 18 });

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    rotateY.set(x * max);
    rotateX.set(-y * max);
  }

  function reset() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div className={cn("[perspective:1200px]", className)} onPointerMove={onMove} onPointerLeave={reset}>
      <m.div style={{ rotateX, rotateY }} className="will-change-transform">
        {children}
      </m.div>
    </div>
  );
}

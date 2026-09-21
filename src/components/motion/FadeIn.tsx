"use client";

import { m, LazyMotion, domAnimation, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface FadeInProps {
  readonly children: ReactNode;
  readonly delay?: number;
  readonly className?: string;
}

/**
 * Scroll-reveal: 12px rise + fade, once, 600ms enter easing (DESIGN.md §7).
 * Under prefers-reduced-motion it renders the final frame with no transform.
 * LazyMotion + domAnimation keeps the bundle to the small feature set we actually use.
 */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={reduced ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

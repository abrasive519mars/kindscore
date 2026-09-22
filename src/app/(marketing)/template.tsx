"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Public pages fade in on every navigation (DESIGN.md §7: 200ms, no slide). A template remounts
 * per route, unlike the layout, which is what makes the transition happen.
 */
export default function MarketingTemplate({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className="flex flex-1 flex-col"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
